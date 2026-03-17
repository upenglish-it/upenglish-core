import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AddSourcesStudentsDTO,
  AddTagsStudentsDTO,
  CreateBulkStudentsDTO,
  CreateStudentDTO,
  FetchStudentsDTO,
  ManageStudentsDTO,
  UpdateStudentDTO,
} from './dto';
import {
  IResponseHandlerParams,
  ResponseHandlerService,
  Accounts,
  STATUS_CODE,
  IAuthTokenPayload,
  ACCOUNT_ID,
  NOTIFICATION_DEFAULT_VALUE,
  StudentsIndexingImport,
  Notifications,
  AccountsProperties,
  ActivityLogs,
  Tags,
  PaginationFieldsU,
  PaginationService,
} from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';
import { FirebaseAdmin, InjectFirebaseAdmin } from 'nestjs-firebase';
import { PipelinesService } from '../../pipelines/pipelines.service';

@Injectable()
export class StudentsServiceService {
  constructor(
    @InjectFirebaseAdmin() private readonly firebase: FirebaseAdmin,
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,
    @InjectModel(AccountsProperties) private readonly accountsProperties: ReturnModelType<typeof AccountsProperties>,
    @InjectModel(Notifications) private readonly notifications: ReturnModelType<typeof Notifications>,
    @InjectModel(StudentsIndexingImport) private readonly studentsIndexingImport: ReturnModelType<typeof StudentsIndexingImport>,
    @InjectModel(ActivityLogs) private readonly activityLogs: ReturnModelType<typeof ActivityLogs>,
    @InjectModel(Tags) private readonly tags: ReturnModelType<typeof Tags>,
    private readonly pipelinesService: PipelinesService
  ) {
    // console.log('`${process.env.FRONTEND_BASE_URL}/i/students`,', `${process.env.FRONTEND_BASE_URL}/i/students`);
    // this.firebase.messaging
    //   .send({
    //     webpush: {
    //       notification: {
    //         title: 'title',
    //         body: 'messagess',
    //         icon: `${process.env.FRONTEND_BASE_URL}/assets/images/logo.png`,
    //         image: `${process.env.FRONTEND_BASE_URL}/assets/images/logo.png`,
    //         badge: `${process.env.FRONTEND_BASE_URL}/assets/images/logo.png`,
    //         data: {
    //           url: `${process.env.FRONTEND_BASE_URL}/i/students`,
    //         },
    //       },
    //     },
    //     token: 'eWCEHAhlqhoEK88a5-8J_P:APA91bHQ4YWOKj2UJWAE-9C37iif24_497MJaij6fhP5eSULRlRDFayU-kXh6bcbyk8etm9eWYQDuLRgOxIGpPj0yjMtuJl0yaDdjU_uc4GhsEnTkxXrbNQlfHDcY6OiS2qKoItUsrJh',
    //   })
    //   .then();
  }

  public async fetch(query: FetchStudentsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const sort = isEmpty(query.sort) ? 1 : query.sort === 'ascending' ? 1 : -1;
      const aggregationQuery: Array<any> = [
        {
          $match: {
            properties: tokenPayload.propertyId,
            role: 'student',
            ...(query.customQuery ? JSON.parse(query.customQuery) : null),
            // ...(query.active ? { active: query.active } : null),
            ...(query.name
              ? { $or: [{ firstName: { $regex: query.name, $options: 'i' } }, { lastName: { $regex: query.name, $options: 'i' } }] }
              : null),
            ...(tokenPayload.queryIds?.branchId
              ? {
                  propertiesBranches: { $in: [...(query?.branches || []), tokenPayload.queryIds.branchId] },
                }
              : null),
          },
        },
        {
          $lookup: {
            from: 'students-tuition-attendance',
            foreignField: 'student',
            localField: '_id',
            pipeline: [
              {
                $project: {
                  records: 1,
                },
              },
              {
                $addFields: {
                  unpaidDays: {
                    $filter: {
                      input: '$records',
                      as: 'record',
                      cond: {
                        // $cond: {
                        //   if: {
                        $and: [{ $eq: ['$$record.paid', false] }, { $eq: ['$$record.enable', true] }, { $eq: ['$$record.included', true] }],
                        // },
                        // then: true,
                        // else: false,
                        // },
                        // $eq: ['$$item.paid', false],
                      },
                    },
                  },
                },
              },
              {
                $addFields: {
                  totalOfUnPaidDays: {
                    $size: '$unpaidDays',
                  },
                },
              },
            ],
            as: 'studentsTuitionAttendance',
          },
        },
        {
          $addFields: {
            classes: {
              $map: {
                input: '$studentsTuitionAttendance',
                as: 'item',
                in: {
                  classId: '$_id',
                  inDebt: {
                    $gt: ['$$item.totalOfUnPaidDays', 0],
                  },
                },
              },
            },
          },
        },
        {
          $project: {
            studentsTuitionAttendance: 0,
          },
        },
        ...PaginationFieldsU(
          typeof query.page === 'string' ? parseInt(query.page) : query.page,
          typeof query.limit === 'string' ? parseInt(query.limit) : query.limit,
          query.sortField || 'firstName',
          sort
        ),
      ];

      const students = await this.accounts.aggregate(aggregationQuery);

      if (isEmpty(students[0]?.items)) {
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
        data: PaginationService(students[0]),
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

  public async fetchById(id: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const student = await this.accounts.findOne({
        _id: id,
        properties: tokenPayload.propertyId,
      });

      if (isEmpty(student)) {
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
        data: student,
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

  public async create(body: CreateStudentDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      /* Check if email is already exist */
      const isEmailExist = await this.accounts.find({
        emailAddresses: { $in: body.emailAddresses.map((v) => v.toLocaleLowerCase()) },
        properties: tokenPayload.propertyId,
      });
      if (!isEmpty(isEmailExist)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.CONFLICT,
          statusCode: STATUS_CODE.ALREADY_EXISTS,
          message: 'Email address is already exist',
        });
      }

      /* Create account */
      const accountId = ACCOUNT_ID(`${body.firstName[0]}${body.lastName[0]}`);
      const role = 'student';

      let birthDate = null;
      if (!isEmpty(body.birthDate)) {
        birthDate = DateTime.fromISO(new Date(body.birthDate).toISOString()).toISODate();
      }

      /* create relationship if it does not exist */
      if (!isEmpty(body.guardians)) {
        for await (const relationship of body.guardians) {
          const existingRelationship = await this.tags.findOne({
            type: 'relationship',
            value: relationship.relationship,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
          });

          /* if relationship is empty then save it */
          if (isEmpty(existingRelationship)) {
            await this.tags.create({
              value: relationship.relationship,
              color: '#f1f1f1',
              type: 'relationship',
              properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
            });
          }
        }
      }

      const createdAccount = await this.accounts.create({
        accountId: accountId,
        firstName: body.firstName,
        lastName: body.lastName,
        emailAddresses: body.emailAddresses.map((v) => v.toLocaleLowerCase()),
        contactNumbers: body.contactNumbers,
        gender: body.gender,
        birthDate: birthDate,
        address: body.address,
        tags: body.tags,
        sources: body.sources,
        guardians: body?.guardians || [],
        additionalNotes: body?.additionalNotes || null,
        properties: tokenPayload.propertyId,
        propertiesBranches: [...body.branches, tokenPayload.branchId],
        sourceBranch: tokenPayload.branchId,
        language: body?.language ? body.language : 'en',
        notification: NOTIFICATION_DEFAULT_VALUE(role),
        role: role,
        cmnd: body.cmnd,
        official: body.official,
        createdFrom: body.createdFrom,
        assignedTo: tokenPayload.accountId,
      });

      /* Save associated property */
      await this.accountsProperties.create({
        accounts: createdAccount._id,
        properties: tokenPayload.propertyId,
      });

      // if (!createdAccount.official) {
      this.activityLogs
        .create({
          action: 'create-a-lead',
          createdBy: tokenPayload.accountId,
          student: createdAccount._id,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        })
        .then();
      // }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Student information was created',
        data: createdAccount,
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

  public async update(id: string, body: UpdateStudentDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const account = await this.accounts.findOne({
        _id: id,
        properties: tokenPayload.propertyId,
      });
      if (isEmpty(account)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      const isEmailExist = await this.accounts.find({
        _id: { $ne: id },
        emailAddresses: { $in: body.emailAddresses },
        properties: tokenPayload.propertyId,
      });
      if (!isEmpty(isEmailExist)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.CONFLICT,
          statusCode: STATUS_CODE.ALREADY_EXISTS,
          message: 'Email address is already exist',
        });
      }

      let birthDate = null;
      if (!isEmpty(body.birthDate)) {
        birthDate = DateTime.fromISO(new Date(body.birthDate).toISOString()).toISODate();
      }

      /* update account */
      const updatedAccount = await this.accounts.findOneAndUpdate(
        { _id: id, properties: tokenPayload.propertyId },
        {
          firstName: body.firstName,
          lastName: body.lastName,
          // ...(account.emailAddresses.length === 0 ? { emailAddresses: body.emailAddresses } : null),
          emailAddresses: body.emailAddresses,
          contactNumbers: body.contactNumbers,
          gender: body.gender,
          propertiesBranches: body?.branches || [],
          birthDate: birthDate,
          address: body.address,
          guardians: body.guardians,
          additionalNotes: body.additionalNotes,
          tags: body.tags,
          cmnd: body.cmnd,
          sources: body.sources,
          active: body.active,
          assignedTo: body.assignedTo,
        },
        { new: true }
      );

      /* Check if the account dont have associated properties - 
      /* due to migration complexity, staff need to hit update button in UI */
      const existingProperties = await this.accountsProperties.find({
        accounts: updatedAccount._id,
        properties: tokenPayload.propertyId,
      });
      if (isEmpty(existingProperties)) {
        /* Save associated property */
        await this.accountsProperties.create({
          accounts: updatedAccount._id,
          properties: tokenPayload.propertyId,
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully updated',
        data: updatedAccount,
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

  public async bulkCreate(body: CreateBulkStudentsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const studentsIndexingImport = await this.studentsIndexingImport.create({
        currentIndex: 0,
        totalOfAlreadyExist: 0,
        totalOfCreated: 0,
        records: body.records,
        accounts: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      this.createStudentByIndexing(studentsIndexingImport._id, tokenPayload);
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Bulk upload has been started. It will notify you once done.',
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

  private async createStudentByIndexing(studentsIndexingImportId: string, tokenPayload: IAuthTokenPayload): Promise<void> {
    const studentFromImportsIndexing = await this.studentsIndexingImport.findOne(
      { _id: studentsIndexingImportId },
      {
        currentIndex: 1,
        record: { $arrayElemAt: ['$records', '$currentIndex'] },
        totalRecords: { $size: '$records' },
        totalOfAlreadyExist: 1,
        totalOfCreated: 1,
      }
    );

    const actionType = 'upload-bulk-student';
    const title = `Import Students via CSV Upload`;

    const account = await this.accounts.findOne({ _id: tokenPayload.accountId });

    try {
      if (studentFromImportsIndexing && studentFromImportsIndexing.record) {
        const createStudentResponse = await this.create(studentFromImportsIndexing.record, tokenPayload);

        if (createStudentResponse.success) {
          // update index for the next student to be import
          await this.studentsIndexingImport.updateOne({ _id: studentsIndexingImportId }, { $inc: { currentIndex: 1, totalOfCreated: 1 } });
          this.createStudentByIndexing(studentsIndexingImportId, tokenPayload);
        } else {
          // student is already exist then update index for the next student to be import
          if (createStudentResponse.statusCode === 'already-exists') {
            await this.studentsIndexingImport.updateOne({ _id: studentsIndexingImportId }, { $inc: { currentIndex: 1, totalOfAlreadyExist: 1 } });
            this.createStudentByIndexing(studentsIndexingImportId, tokenPayload);
          } else {
            // notify user that having a problem while uploading students
            const message = `There was a problem in the record while processing`;
            this.notifications
              .create({
                actionType: actionType,
                title: title,
                message: message,
                data: {
                  studentImportIndexingId: studentFromImportsIndexing._id,
                },
                accounts: tokenPayload.accountId,
                properties: tokenPayload.propertyId,
                propertiesBranches: tokenPayload.branchId,
              })
              .then();

            if (account.notification.leadCreation) {
              // this.firebase.messaging
              //   .send({
              //     webpush: {
              //       notification: {
              //         title: title,
              //         body: message,
              //         icon: `${process.env.FRONTEND_BASE_URL}/assets/images/logo.png`,
              //         image: `${process.env.FRONTEND_BASE_URL}/assets/images/logo.png`,
              //         badge: `${process.env.FRONTEND_BASE_URL}/assets/images/logo.png`,
              //         data: {
              //           url: `${process.env.FRONTEND_BASE_URL}/i/students`,
              //         },
              //       },
              //       // fcmOptions: {
              //       //   link: `${process.env.FRONTEND_BASE_URL}/i/students`,
              //       // },
              //       // data: {},
              //     },
              //     token: account.gcmToken,
              //   })
              //   .then();
            }
          }
        }
      } else {
        // notify user import is completed
        console.log('done creation');

        const title = `Import Students via CSV upload`;
        const message = `${studentFromImportsIndexing.totalOfCreated} was created, ${studentFromImportsIndexing.totalOfAlreadyExist} already exist. In total you uploaded ${studentFromImportsIndexing.totalRecords}`;

        this.notifications
          .create({
            actionType: actionType,
            title: title,
            message: message,
            data: {
              studentImportIndexingId: studentFromImportsIndexing._id,
            },
            accounts: tokenPayload.accountId,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
          })
          .then();

        if (account.notification.leadCreation) {
          // this.firebase.messaging
          //   .send({
          //     webpush: {
          //       notification: {
          //         title: title,
          //         body: `${studentFromImportsIndexing.totalOfCreated} was created. ${studentFromImportsIndexing.totalOfAlreadyExist} already exist. In total you uploaded ${studentFromImportsIndexing.totalRecords} records`,
          //         icon: `${process.env.FRONTEND_BASE_URL}/assets/images/logo.png`,
          //         image: `${process.env.FRONTEND_BASE_URL}/assets/images/logo.png`,
          //         badge: `${process.env.FRONTEND_BASE_URL}/assets/images/logo.png`,
          //         // click_action: `${process.env.FRONTEND_BASE_URL}/i/students`,
          //         data: {
          //           url: `${process.env.FRONTEND_BASE_URL}/i/students`,
          //         },
          //       },
          //       // fcmOptions: {
          //       //   link: `${process.env.FRONTEND_BASE_URL}/i/students`,
          //       // },
          //       // data: {},
          //     },
          //     token: account.gcmToken,
          //   })
          //   .then();
        }
      }
    } catch (error) {
      // console.log('catch > There was a problem while uploading the students');
      // notify user that having a problem while uploading students
      const message = `There was a problem while uploading the students`;
      this.notifications
        .create({
          actionType: actionType,
          title: title,
          message: message,
          data: {
            studentImportIndexingId: studentFromImportsIndexing?._id,
          },
          accounts: tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        })
        .then();

      if (account.notification.leadCreation) {
        // this.firebase.messaging
        //   .send({
        //     webpush: {
        //       notification: {
        //         title: title,
        //         body: message,
        //         icon: `${process.env.FRONTEND_BASE_URL}/assets/images/logo.png`,
        //         image: `${process.env.FRONTEND_BASE_URL}/assets/images/logo.png`,
        //         badge: `${process.env.FRONTEND_BASE_URL}/assets/images/logo.png`,
        //         // click_action: `${process.env.FRONTEND_BASE_URL}/i/students`,
        //         data: {
        //           url: `${process.env.FRONTEND_BASE_URL}/i/students`,
        //         },
        //       },
        //       // fcmOptions: {
        //       //   link: `${process.env.FRONTEND_BASE_URL}/i/students`,
        //       // },
        //       // data: {},
        //     },
        //     token: account.gcmToken,
        //   })
        //   .then();
      }
    }
  }

  public async addTags(body: AddTagsStudentsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.accounts.updateMany(
        {
          _id: { $in: body.studentIds },
          properties: tokenPayload.propertyId,
        },
        {
          $addToSet: {
            tags: { $each: body.tags },
          },
        }
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully added',
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

  public async addSources(body: AddSourcesStudentsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.accounts.updateMany(
        {
          _id: { $in: body.studentIds },
          properties: tokenPayload.propertyId,
        },
        {
          $addToSet: {
            sources: { $each: body.sources },
          },
        }
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully added',
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

  public async manage(body: ManageStudentsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      if (body.action === 'delete') {
        this.accounts
          .updateMany(
            {
              $in: { _id: body.leadIds },
              createdBy: tokenPayload.accountId,
              properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
            },
            {
              $set: {
                deleted: true,
              },
            }
          )
          .then();
      }

      if (body.action === 'remove-from-pipelines') {
        for (const pipelineId of body.pipeline.pipelineIds) {
          return await this.pipelinesService.unAssignCandidates(
            pipelineId,
            {
              pipelineStageId: body.pipeline.pipelineStageId,
              leadIds: body.leadIds,
              type: 'leads',
            },
            tokenPayload
          );
        }
      }

      if (body.action === 'add-to-pipelines') {
        for (const pipelineId of body.pipeline.pipelineIds) {
          this.pipelinesService.assignCandidates(
            pipelineId,
            {
              pipelineStageId: body.pipeline.pipelineStageId,
              leadIds: body.leadIds,
              type: 'leads',
            },
            tokenPayload
          );
        }
      }

      if (body.action === 'add-to-pipeline-with-pipeline-stage') {
        return await this.pipelinesService.assignCandidates(
          body.pipeline.pipelineIds[0],
          {
            pipelineStageId: body.pipeline.pipelineStageId,
            leadIds: body.leadIds,
            type: 'leads',
          },
          tokenPayload
        );
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully updated',
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
