import { HttpStatus, Injectable } from '@nestjs/common';
import {
  IResponseHandlerParams,
  ResponseHandlerService,
  STATUS_CODE,
  IAuthTokenPayload,
  Tasks,
  IGenericNameValue,
  TasksSubmissions,
  Accounts,
  StudentsTuitionAttendance,
  Classes,
  MongoDBWebhook,
  Notifications,
  TasksSubmissionsInstances,
} from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { groupBy, isEmpty, uniq } from 'lodash';
import { CreateTaskDTO, ImportTaskCSVDTO, ManageInstancesSettingsDTO, UpdateTaskBuilderDTO, UpdateTaskSettingsDTO } from './dto';
import { DateTime } from 'luxon';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Tasks) private readonly tasks: ReturnModelType<typeof Tasks>,
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,
    @InjectModel(Classes) private readonly classes: ReturnModelType<typeof Classes>,
    @InjectModel(StudentsTuitionAttendance) private readonly studentsTuitionAttendance: ReturnModelType<typeof StudentsTuitionAttendance>,
    @InjectModel(TasksSubmissionsInstances) private readonly tasksSubmissionsInstances: ReturnModelType<typeof TasksSubmissionsInstances>,
    @InjectModel(TasksSubmissions) private readonly tasksSubmissions: ReturnModelType<typeof TasksSubmissions>,
    @InjectModel(Notifications) private readonly notifications: ReturnModelType<typeof Notifications>,
  ) {}

  public async webhook(body: MongoDBWebhook): Promise<IResponseHandlerParams> {
    try {
      // console.log('body', JSON.stringify(body, null, 2));

      if (body.operationType === 'update') {
        const oldRecord: Tasks = body.fullDocumentBeforeChange;
        const newRecord: Tasks = body.fullDocument;
        const newlyAddedReviewers = oldRecord.assignee.reviewers.filter((id) => newRecord.assignee.reviewers.includes(id));
        // console.log('newlyAddedReviewers', newlyAddedReviewers);
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Webhook received',
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async create(body: CreateTaskDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const task = await this.tasks.create({
        mode: body.mode,
        course: body.course,
        class: body.class,
        generalInfo: body.generalInfo,
        assignee: { reviewers: [tokenPayload.accountId], participants: [] },
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Task was created',
        data: task,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async updateBuilderById(taskId: string, body: UpdateTaskBuilderDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const task = await this.tasks.findOneAndUpdate(
        {
          _id: taskId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        { categories: body.categories },
        { new: true },
      );

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Builder was updated',
        data: task,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async updateSettingsById(taskId: string, body: UpdateTaskSettingsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const oldTask = await this.tasks.findOne({
        _id: taskId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      const newTask = await this.tasks.findOneAndUpdate(
        {
          _id: taskId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        {
          $set: {
            generalInfo: body.generalInfo,
            assignee: body.assignee,
            status: body.status,
            mode: body.mode,
            course: body.course,
            class: body.class,
          },
        },
        { new: true },
      );

      const newlyAddedReviewers = body.assignee.reviewers.filter((r) => !oldTask.assignee.reviewers.includes(r));
      console.log('newlyAddedReviewers', newlyAddedReviewers);
      if (!isEmpty(newlyAddedReviewers)) {
        for (const accountId of newlyAddedReviewers) {
          await this.notifications.create({
            actionType: 'assign-task-to-reviewer',
            title: 'Assigned Task',
            message: null,
            data: {
              taskId: newTask._id,
            },
            accounts: accountId,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
          });
        }
      }

      const newlyAddedParticipants = body.assignee.participants.filter((r) => !oldTask.assignee.participants.map((p) => p.id).includes(r.id));
      console.log('newlyAddedParticipants', newlyAddedParticipants);
      if (!isEmpty(newlyAddedParticipants)) {
        let participantIds: Array<string> = [];
        for await (const participant of newlyAddedParticipants) {
          if (participant.type === 'student') {
            participantIds.push(participant.id);
          }
          if (participant.type === 'class') {
            const classes = await this.classes.aggregate([
              {
                $match: {
                  _id: participant.id,
                  // status: 'ongoing',
                  properties: tokenPayload.propertyId,
                  propertiesBranches: tokenPayload.branchId,
                  deleted: false,
                },
              },
              // {
              //   $lookup: {
              //     from: 'students-tuition-attendance',
              //     foreignField: 'classes',
              //     localField: '_id',
              //     as: 'studentsTuitionAttendance',
              //   },
              // },

              ////
              // { $lookup: { from: 'students-tuition-attendance', foreignField: 'classes', localField: '_id', as: 'totalMembers' } },
              // { $addFields: { xd: '$totalMembers' } },
              // { $addFields: { totalMembers: [{ $size: '$totalMembers' }] } },
              // { $addFields: { totalMembers: { $arrayElemAt: ['$totalMembers', 0] } } },
              {
                $lookup: {
                  from: 'students-tuition-attendance',
                  let: {
                    id: '$_id',
                    student: '$student',
                  },
                  pipeline: [
                    {
                      $match: {
                        status: 'ongoing',
                      },
                    },
                    {
                      $project: {
                        records: 0,
                        paymentHistory: 0,
                      },
                    },
                    {
                      $lookup: {
                        from: 'accounts',
                        localField: 'student',
                        foreignField: '_id',
                        pipeline: [
                          {
                            $project: {
                              firstName: 1,
                              lastName: 1,
                            },
                          },
                        ],
                        as: 'studentInfo',
                      },
                    },
                    {
                      $unwind: '$studentInfo',
                    },
                  ],
                  as: 'studentsTuitionAttendance',
                },
              },
              {
                $addFields: {
                  totalMembers: [
                    {
                      $size: '$studentsTuitionAttendance',
                    },
                  ],
                },
              },
              {
                $addFields: {
                  totalMembers: {
                    $arrayElemAt: ['$totalMembers', 0],
                  },
                },
              },
            ]);

            if (!isEmpty(classes)) {
              const classInfo: Classes = classes[0];
              console.log('classInfo', classInfo);
              if (!isEmpty(classInfo.tuitionAttendances)) {
                classInfo.tuitionAttendances.forEach(() => {
                  participantIds.push(participant.id);
                });
              }

              // participants.push({
              //   name: classInfo.name,
              //   value: {
              //     id: participant.id,
              //     type: participant.type,
              //     members: classInfo,
              //     totalMembers: classInfo.totalMembers,
              //   },
              // });

              // participantIds.push(participant.id);
            }
          }
        }

        console.log('participantIds', participantIds);
        /* remove duplicate ids */
        participantIds = uniq(participantIds);

        console.log('participantIds 2', participantIds);
      }

      const instancesParticipantIds = [];

      console.log('oldTask.assignee.participants', oldTask.assignee.participants);
      for await (const participant of oldTask.assignee.participants) {
        if (participant.type === 'student') {
          instancesParticipantIds.push(participant.id);
        }
        if (participant.type === 'class') {
          const classes = await this.classes.aggregate([
            {
              $match: {
                _id: participant.id,
                // status: 'ongoing',
                properties: tokenPayload.propertyId,
                propertiesBranches: tokenPayload.branchId,
                deleted: false,
              },
            },
            {
              $lookup: {
                from: 'students-tuition-attendance',
                let: {
                  id: '$_id',
                  student: '$student',
                },
                pipeline: [
                  {
                    $match: {
                      status: 'ongoing',
                    },
                  },
                  {
                    $project: {
                      records: 0,
                      paymentHistory: 0,
                    },
                  },
                  {
                    $lookup: {
                      from: 'accounts',
                      localField: 'student',
                      foreignField: '_id',
                      pipeline: [
                        {
                          $project: {
                            firstName: 1,
                            lastName: 1,
                          },
                        },
                      ],
                      as: 'studentInfo',
                    },
                  },
                  {
                    $unwind: '$studentInfo',
                  },
                ],
                as: 'tuitionAttendances',
              },
            },
            {
              $addFields: {
                totalMembers: [
                  {
                    $size: '$tuitionAttendances',
                  },
                ],
              },
            },
            {
              $addFields: {
                totalMembers: {
                  $arrayElemAt: ['$totalMembers', 0],
                },
              },
            },
          ]);

          if (!isEmpty(classes)) {
            const classInfo: Classes = classes[0];
            console.log('classInfo', classInfo);
            if (!isEmpty(classInfo.tuitionAttendances)) {
              classInfo.tuitionAttendances.forEach((c) => {
                instancesParticipantIds.push(c.student);
              });
            }
          }
        }
      }

      console.log('instancesParticipantIds', instancesParticipantIds);
      for await (const accountId of instancesParticipantIds) {
        if (newTask.status === 'published') {
          this.tasksSubmissionsInstances
            .findOneAndUpdate(
              {
                participant: accountId,
                task: taskId,
                properties: tokenPayload.propertyId,
                propertiesBranches: tokenPayload.branchId,
              },
              { $set: { instances: newTask.generalInfo.instances } },
              { new: true, upsert: true, setDefaultsOnInsert: true },
            )
            .then();
        } else {
          this.tasksSubmissionsInstances
            .findOneAndUpdate(
              {
                participant: accountId,
                task: taskId,
                properties: tokenPayload.propertyId,
                propertiesBranches: tokenPayload.branchId,
              },
              { $set: { instances: 0 } },
              { new: true, upsert: true, setDefaultsOnInsert: true },
            )
            .then();
        }
      }

      const updatedTask = await this.fetchById(taskId, tokenPayload);
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Settings was updated',
        data: updatedTask.data,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async participantsSubmissions(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const task = await this.tasks.findOne({ properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId, deleted: false });

      if (isEmpty(task)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: task,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async assigneeParticipants(taskId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const task = await this.tasks.findOne({ _id: taskId, properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId, deleted: false });

      if (isEmpty(task)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      const participants: Array<IGenericNameValue> = [];
      for await (const participant of task.assignee.participants) {
        if (participant.type === 'student') {
          const account = await this.accounts.findOne({ _id: participant.id, properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId, deleted: false });
          participants.push({
            name: `${account.firstName} ${account.lastName}`.trim(),
            value: {
              id: participant.id,
              type: participant.type,
              emailAddress: account.emailAddresses[0],
            },
          });
        }
        if (participant.type === 'class') {
          const classes = await this.classes.aggregate([
            {
              $match: {
                _id: participant.id,
                // status: 'ongoing',
                properties: tokenPayload.propertyId,
                propertiesBranches: tokenPayload.branchId,
                deleted: false,
              },
            },
            // {
            //   $lookup: {
            //     from: 'students-tuition-attendance',
            //     foreignField: 'classes',
            //     localField: '_id',
            //     as: 'studentsTuitionAttendance',
            //   },
            // },

            ////
            // { $lookup: { from: 'students-tuition-attendance', foreignField: 'classes', localField: '_id', as: 'totalMembers' } },
            // { $addFields: { xd: '$totalMembers' } },
            // { $addFields: { totalMembers: [{ $size: '$totalMembers' }] } },
            // { $addFields: { totalMembers: { $arrayElemAt: ['$totalMembers', 0] } } },
            {
              $lookup: {
                from: 'students-tuition-attendance',
                let: {
                  classId: '$_id',
                  student: '$student',
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [{ $eq: ['$status', 'ongoing'] }, { $eq: ['$classes', '$$classId'] }],
                      },
                    },
                  },
                  {
                    $project: {
                      records: 0,
                      paymentHistory: 0,
                    },
                  },
                  {
                    $lookup: {
                      from: 'accounts',
                      localField: 'student',
                      foreignField: '_id',
                      pipeline: [
                        {
                          $project: {
                            firstName: 1,
                            lastName: 1,
                          },
                        },
                      ],
                      as: 'studentInfo',
                    },
                  },
                  {
                    $unwind: '$studentInfo',
                  },
                ],
                as: 'studentsTuitionAttendance',
              },
            },
            {
              $addFields: {
                totalMembers: [
                  {
                    $size: '$studentsTuitionAttendance',
                  },
                ],
              },
            },
            {
              $addFields: {
                totalMembers: {
                  $arrayElemAt: ['$totalMembers', 0],
                },
              },
            },
          ]);

          if (!isEmpty(classes)) {
            const classInfo = classes[0];
            participants.push({
              name: classInfo.name,
              value: {
                id: participant.id,
                type: participant.type,
                members: classInfo,
                totalMembers: classInfo.totalMembers,
              },
            });
          }
        }
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: participants,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async manageParticipantInstances(taskId: string, body: ManageInstancesSettingsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      //
      console.log('manageParticipantInstances >>> ', taskId, body);

      /* Reset the instance */
      for (const id of body.ids) {
        this.tasksSubmissionsInstances
          .findOneAndUpdate(
            {
              participant: id,
              task: taskId,
              properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
            },
            { $set: { instances: 0 } },
            { new: true },
          )
          .then();
      }

      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.NOT_FOUND,
        statusCode: STATUS_CODE.NOT_FOUND,
        message: 'No result(s) found',
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async getParticipantInstances(taskId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const tasksSubmissionsInstances = await this.tasksSubmissionsInstances.findOne({
        participant: tokenPayload.accountId,
        task: taskId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.OK,
        data: tasksSubmissionsInstances,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async fetch(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    console.log('tokenPayload', tokenPayload);

    try {
      const tasks = await this.tasks
        .aggregate([
          {
            $match: {
              // $in: { reviewers: [tokenPayload.accountId] },
              $or: [
                {
                  'assignee.reviewers': {
                    $in: [tokenPayload.accountId],
                  },
                },
                {
                  createdBy: tokenPayload.accountId,
                },
              ],
              // properties: tokenPayload.propertyId,
              // propertiesBranches: tokenPayload.branchId,
              ...(tokenPayload.queryIds.propertyId ? { properties: tokenPayload.queryIds.propertyId } : null),
              ...(tokenPayload.queryIds.branchId ? { propertiesBranches: tokenPayload.queryIds.branchId } : null),
              deleted: false,
            },
          },

          /* created by */
          {
            $lookup: {
              from: 'accounts',
              foreignField: '_id',
              localField: 'createdBy',
              as: 'createdBy',
            },
          },
          {
            $project: {
              assignee: 0,
              'categories.questions.description': 0,
            },
          },
          {
            $unwind: '$createdBy',
          },
        ])
        .sort({ createdAt: -1 });

      if (isEmpty(tasks)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: tasks,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async fetchById(taskId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const tasks = await this.tasks.aggregate([
        {
          $match: {
            _id: taskId,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
            deleted: false,
          },
        },

        /* created by */
        {
          $lookup: {
            from: 'accounts',
            foreignField: '_id',
            localField: 'createdBy',
            as: 'createdBy',
          },
        },
        {
          $unwind: '$createdBy',
        },
      ]);

      if (isEmpty(tasks)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      const task: Tasks = tasks[0];

      task['totalTaken'] = 0; // added only for homework. can be taken twice only
      if (task.generalInfo.type === 'homework') {
        const tasks = await this.tasksSubmissions.find({
          'task._id': task._id,
          participant: tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        });
        task['totalTaken'] = tasks.length;
      }

      if (task)
        return ResponseHandlerService({
          success: true,
          httpCode: HttpStatus.OK,
          statusCode: STATUS_CODE.HAS_DATA,
          data: task,
        });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async reports(query: any, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      console.log('queryx', query);
      const tasksSubmissions = await this.tasksSubmissions.aggregate([
        {
          $match: {
            'task.class': query.class,
            'task.assignee.participants.id': { $in: [tokenPayload.accountId] },
            ...(!isEmpty(query.date)
              ? {
                  createdAt: {
                    $gte: DateTime.fromISO(query.date).startOf('month'), // Start date
                    $lte: DateTime.fromISO(query.date).endOf('month'), // End date
                  },
                }
              : {
                  createdAt: {
                    $gte: DateTime.now().startOf('year'), // Start date
                    $lte: DateTime.now().endOf('year'), // End date
                  },
                }),
          },
        },

        /* created by */
        // {
        //   $lookup: {
        //     from: 'accounts',
        //     foreignField: '_id',
        //     localField: 'createdBy',
        //     as: 'createdBy',
        //   },
        // },
        // {
        //   $unwind: '$createdBy',
        // },
      ]);

      console.log('tasks', tasksSubmissions);

      if (isEmpty(tasksSubmissions)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      const groupedByMonth = groupBy(
        tasksSubmissions,
        (task) => DateTime.fromISO(task.createdAt).toFormat('yyyy-MM'), // Format: YYYY-MM
      );

      console.log('groupedByMonth', groupedByMonth);

      const chartData = Object.entries(groupedByMonth).map(([month, tasks]) => ({
        x: DateTime.fromFormat(month, 'yyyy-MM').toFormat('MMMM yyyy'), // Full month name and year
        y: tasks.length, // Count of tasks in the month
      }));
      console.log('chartData', chartData);

      const homework = tasksSubmissions
        .filter((tasksSubmission: TasksSubmissions) => tasksSubmission.task.generalInfo.type === 'homework')
        .map((tasksSubmission: TasksSubmissions) => {
          const totalScore = tasksSubmission.task.categories.reduce((pv: number, cv) => pv + cv.questions[0].reviewerScore, 0);
          const points = tasksSubmission.task.categories.reduce((pv: number, cv) => pv + cv.points, 0);
          return totalScore / points;
        }) || [0];

      const challenge = tasksSubmissions
        .filter((tasksSubmission: TasksSubmissions) => tasksSubmission.task.generalInfo.type === 'challenge')
        .map((tasksSubmission: TasksSubmissions) => {
          const totalScore = tasksSubmission.task.categories.reduce((pv: number, cv) => pv + cv.questions[0].reviewerScore, 0);
          const points = tasksSubmission.task.categories.reduce((pv: number, cv) => pv + cv.points, 0);
          return totalScore / points;
        }) || [0];

      const series = [
        {
          name: 'Homework',
          data: homework.length > 0 ? homework : [0],
        },
        {
          name: 'Challenge',
          data: challenge.length > 0 ? challenge : [0],
        },
      ];

      // Step 1: Find the longest array
      const longestChallenge = series.reduce((longest, current) => {
        return current.data.length > longest.data.length ? current : longest;
      }, series[0]);

      console.log(`Longest Challenge: ${longestChallenge.name}`);

      // Step 2: Generate a date range
      const startDate = DateTime.local(); // Start from today
      const dateRange = Array.from({ length: longestChallenge.data.length }, (_, i) => startDate.plus({ days: i }).toISODate());

      console.log(`Date Range for ${longestChallenge.name}:`, dateRange);

      const categories = dateRange;
      // isEmpty(query.date)
      //   ? Array.from({ length: 12 }, (_, i) =>
      //       DateTime.local()
      //         .set({ month: i + 1 })
      //         .toFormat('MMM'),
      //     )
      //   : [DateTime.fromISO(query.date).toFormat('MMM')];

      // ['01 Jan', '02 Jan', '03 Jan', '04 Jan', '05 Jan', '06 Jan', '07 Jan', '08 Jan', '09 Jan', '10 Jan', '11 Jan', '12 Jan']; //date

      // for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
      //   const submission:TasksSubmissions = tasks[taskIndex];

      //   series.push({
      //     name: submission.task.generalInfo.type.toUpperCase(),
      //     data:
      //   });
      // }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: { series, categories },
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async softDelete(taskId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.tasks.updateOne(
        {
          _id: taskId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        { deleted: true },
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Task has been deleted',
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async sharedParticipant(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const tasks = await this.tasks.find({
        status: 'published',
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
        deleted: false,
      });

      if (isEmpty(tasks)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      const assignedTask = [];
      for await (const task of tasks) {
        const inStudentParticipants = task.assignee.participants.find((p) => p.id === tokenPayload.accountId);

        let studentsTuitionAttendance = null;
        const classIds = task.assignee.participants.filter((p) => p.type === 'class').map((p) => p.id);

        if (!isEmpty(classIds)) {
          console.log({
            classes: { $in: classIds },
            student: tokenPayload.accountId,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
            deleted: false,
          });
          studentsTuitionAttendance = await this.studentsTuitionAttendance.find(
            {
              classes: { $in: classIds },
              student: tokenPayload.accountId,
              properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
              deleted: false,
            },
            { classes: 1 },
          );
          console.log('inClassParticipants', studentsTuitionAttendance, classIds);
        }

        if (!isEmpty(inStudentParticipants) || !isEmpty(studentsTuitionAttendance)) {
          assignedTask.push(task);
        }
      }

      if (isEmpty(assignedTask)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No assigned task',
        });
      }

      //  const tasks = await this.tasks.find({
      //    properties: tokenPayload.propertyId,
      //    propertiesBranches: tokenPayload.branchId,
      //    deleted: false,
      //  });

      //  if (isEmpty(tasks)) {
      //    return ResponseHandlerService({
      //      success: false,
      //      httpCode: HttpStatus.NOT_FOUND,
      //      statusCode: STATUS_CODE.NOT_FOUND,
      //      message: 'No result(s) found',
      //    });
      //  }
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: assignedTask,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async importCSV(body: ImportTaskCSVDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      for await (const record of body.records) {
        await this.tasks.create({
          mode: record.mode,
          status: record.status,
          course: null,
          class: null,
          generalInfo: {
            type: record.generalInfo.type,
            title: record.generalInfo.title,
            passing: record.generalInfo.passing,
            duration: {
              noExpiration: record.generalInfo.duration.noExpiration,
              value: record.generalInfo.duration.value,
              type: record.generalInfo.duration.type,
            },
            expand: true,
          },
          categories: record.categories,
          assignee: { reviewers: [tokenPayload.accountId], participants: [], expand: true },
          createdBy: tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async copyToBranch(branchId: string, taskId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const task = await this.tasks.findOne({ _id: taskId, properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId });

      const jsonTask = task.toJSON();
      delete jsonTask._id;

      await this.tasks.create({
        ...jsonTask,
        generalInfo: {
          ...jsonTask.generalInfo,
        },
        assignee: {
          reviewers: [],
          participants: [],
          expand: true,
        },
        createdBy: tokenPayload.accountId,
        mode: 'training',
        status: 'unpublished',
        class: null,
        deleted: false,
        propertiesBranches: branchId,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: ' Successfully copied.',
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }
}
