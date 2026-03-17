import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { isEmpty } from 'lodash';
import {
  AddPipelineStagePipelineDTO,
  AssignCandidatesPipelineDTO,
  ClonePipelineDTO,
  CreatePipelineDTO,
  RemovePipelineStagePipelineDTO,
  UnAssignCandidatesPipelineDTO,
  UpdatePipelineStatusDTO,
  UpdatePipelineStagePipelineDTO,
  AddNoteDTO,
  PipelineLeadInfoDTO,
  AddConversationDTO,
  SortPipelineStagePipelineDTO,
  GetPipelineQueryDTO,
  ManageTaskInTaskPipelineDTO,
  DeleteTaskInTaskPipelineDTO,
} from './dto';
import { DateTime } from 'luxon';
import {
  Accounts,
  ActivityLogs,
  IAuthTokenPayload,
  IResponseHandlerParams,
  Notifications,
  PipelineLeadsItemI,
  Pipelines,
  PipelinesActivityLogs,
  PipelinesConversations,
  PipelinesNotes,
  ResponseHandlerService,
  STATUS_CODE,
  SYSTEM_ID,
} from 'apps/common';

@Injectable()
export class PipelinesService {
  constructor(
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,
    @InjectModel(Notifications) private readonly notifications: ReturnModelType<typeof Notifications>,
    @InjectModel(ActivityLogs) private readonly activityLogs: ReturnModelType<typeof ActivityLogs>,
    @InjectModel(Pipelines) private readonly pipelines: ReturnModelType<typeof Pipelines>,
    @InjectModel(PipelinesNotes) private readonly pipelinesNotes: ReturnModelType<typeof PipelinesNotes>,
    @InjectModel(PipelinesActivityLogs) private readonly pipelinesActivityLogs: ReturnModelType<typeof PipelinesActivityLogs>,
    @InjectModel(PipelinesConversations) private readonly pipelinesConversations: ReturnModelType<typeof PipelinesConversations> // @InjectModel(RecruiterPipeline) private readonly pipeline: ReturnModelType<typeof RecruiterPipeline>,
  ) {}

  public async leadInfo(pipelineId: string, query: PipelineLeadInfoDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const allSettledPromise = await Promise.allSettled([
        this.accounts.findOne(
          {
            _id: query.leadId,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
          },
          { profilePhoto: 0 }
        ),
        this.pipelines.findOne({
          _id: pipelineId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        }),
      ]);

      const leadInfo: Accounts = allSettledPromise.at(0).status === 'fulfilled' ? allSettledPromise.at(0)['value'] : null;
      const pipeline: Pipelines = allSettledPromise.at(1).status === 'fulfilled' ? allSettledPromise.at(1)['value'] : null;

      if (isEmpty(leadInfo) || isEmpty(pipeline)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      const ownerInfo = await this.accounts.findOne(
        {
          _id: pipeline.sourcingTeam.ownerId,
        },
        { profilePhoto: 0 }
      );

      const lead = pipeline.items.find((lead) => lead.id === query.leadId) as PipelineLeadsItemI;

      const currentPipelineStage = pipeline.sourcingPipeline.stages.find((stage) => stage.id === lead.pipelineStageId);

      const addedByInfo = await this.accounts.findOne({ _id: lead.addedBy });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: {
          leadInfo: leadInfo,
          ownerInfo: ownerInfo,
          addedByInfo: addedByInfo,
          pipeline: pipeline,
          currentPipelineStage: currentPipelineStage,
        },
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
    try {
      const pipelines = await this.pipelines
        .aggregate([
          {
            $match: {
              // createdBy: tokenPayload.accountId,
              $or: [
                {
                  'sourcingTeam.participantIds': {
                    $in: [tokenPayload.accountId],
                  },
                },
                {
                  createdBy: tokenPayload.accountId,
                },
              ],
              properties: tokenPayload.propertyId,
              // propertiesBranches: tokenPayload.branchId,
              ...(tokenPayload.queryIds.branchId ? { propertiesBranches: tokenPayload.branchId } : null),
              deleted: false,
            },
          },
        ])
        .sort({ createdAt: -1 });

      if (isEmpty(pipelines)) {
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
        data: pipelines,
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

  public async fetchById(pipelineId: string, query: GetPipelineQueryDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      if (query.type === 'task') {
        const pipeline = await this.pipelines.findOne({
          _id: pipelineId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        });

        if (isEmpty(pipeline)) {
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
          data: pipeline,
        });
      }

      const pipeline = await this.pipelines.aggregate([
        {
          $match: {
            _id: pipelineId,
            // createdBy: tokenPayload.account,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
            deleted: false,
          },
        },
        {
          $addFields: {
            leadIds: {
              $map: {
                input: '$items',
                in: '$$this.id',
              },
            },
          },
        },

        {
          $lookup: {
            from: 'accounts',
            let: {
              ids: '$leadIds',
              pipelineId: '$_id',
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ['$_id', '$$ids'],
                  },
                },
              },

              {
                $lookup: {
                  from: 'pipelines-notes',
                  let: {
                    leadId: '$_id',
                  },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            {
                              $eq: ['$lead', '$$leadId'],
                            },
                            {
                              $eq: ['$pipeline', '$$pipelineId'],
                            },
                          ],
                        },
                      },
                    },
                  ],
                  as: 'notes',
                },
              },

              {
                $lookup: {
                  from: 'pipelines-conversations',
                  let: {
                    leadId: '$_id',
                  },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            {
                              $eq: ['$lead', '$$leadId'],
                            },
                            {
                              $eq: ['$pipeline', '$$pipelineId'],
                            },
                          ],
                        },
                      },
                    },
                  ],
                  as: 'conversations',
                },
              },

              {
                $lookup: {
                  from: 'pipelines-activity-logs',
                  let: {
                    leadId: '$_id',
                  },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            {
                              $eq: ['$lead', '$$leadId'],
                            },
                            {
                              $eq: ['$pipeline', '$$pipelineId'],
                            },
                          ],
                        },
                      },
                    },
                  ],
                  as: 'activityLogs',
                },
              },

              {
                $addFields: {
                  notes: { $size: '$notes' },
                  conversations: {
                    $size: '$conversations',
                  },
                  activityLogs: {
                    $size: '$activityLogs',
                  },
                },
              },

              {
                $project: {
                  profilePhoto: 0,
                  organization: 0,
                  updatedAt: 0,
                  workspace: 0,
                  workspaceSpace: 0,
                  workspaceSpaces: 0,
                },
              },
            ],
            as: 'concatedLeads',
          },
        },
        {
          $addFields: {
            items: {
              $map: {
                input: '$items',
                as: 'lead',
                in: {
                  $mergeObjects: [
                    '$$lead',
                    {
                      info: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: '$concatedLeads',
                              as: 'concatedLead',
                              cond: {
                                $eq: ['$$concatedLead._id', '$$lead.id'],
                              },
                            },
                          },
                          0,
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        },

        {
          $addFields: {
            'sourcingPipeline.stages': {
              $map: {
                input: '$sourcingPipeline.stages',
                as: 'stage',
                in: {
                  $mergeObjects: [
                    '$$stage',
                    {
                      leads: {
                        $filter: {
                          input: '$items',
                          as: 'lead',
                          cond: {
                            $eq: ['$$lead.pipelineStageId', '$$stage.id'],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      ]);

      console.log('Assigned stage', pipeline);

      if (isEmpty(pipeline)) {
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
        data: pipeline[0],
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

  public async fetchByCompanyName(companyName: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const pipeline = await this.pipelines.aggregate([
        {
          $match: {
            _id: companyName,
            createdBy: tokenPayload.accountId,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
            deleted: false,
          },
        },
      ]);

      if (isEmpty(pipeline)) {
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
        data: pipeline[0],
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

  public async create(body: CreatePipelineDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      // modify this, if type is task then change the stage to either with name, notes or empty []
      let title = body.title;
      const totalOfExisting = await this.pipelines.find({
        'details.title': title,
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      if (!isEmpty(totalOfExisting)) {
        title = `${title} - ${DateTime.now().toFormat('X')}`;
      }

      const createdPipeline = await this.pipelines.create({
        details: {
          title: title,
        },
        sourcingTeam: {
          ownerId: tokenPayload.accountId,
          participantIds: [],
        },
        sourcingPipeline: {
          stages: [
            {
              order: 0,
              state: 'start',
              type: 'sourced',
              title: 'Lost',
              color: '#f6f8f9',
              id: SYSTEM_ID(),
              editable: false,
              won: false,
            },
            {
              order: 0,
              state: 'end',
              type: 'completed',
              title: 'Won',
              color: '#f6f8f9',
              id: SYSTEM_ID(),
              editable: false,
              won: true,
            },
          ],
          expand: true,
        },
        type: body.type,
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
        data: createdPipeline,
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

  public async clone(body: ClonePipelineDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      let title = body.title;
      const totalOfExisting = await this.pipelines.find({
        'details.title': title,
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      if (!isEmpty(totalOfExisting)) {
        title = `${title} - ${DateTime.now().toFormat('X')}`;
      }

      const pipelineInfo = await this.pipelines.findOne({
        _id: body.pipelineId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      pipelineInfo.details.title = title;

      const createdPipeline = await this.pipelines.create({
        details: pipelineInfo.details,
        sourcingTeam: pipelineInfo.sourcingTeam,
        sourcingPipeline: pipelineInfo.sourcingPipeline,
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
        data: createdPipeline,
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

  // public async create(bodyx: CreatePipelineDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   try {
  //     const body = {
  //       details: {
  //         title: 'Java Developer',
  //         department: '2',
  //         quantity: 5,
  //         openingAndClosingDate: ['2023-08-22', '2023-09-29'],
  //         description: '<p>asdd</p>',
  //         requirements: '<p>asdasd</p>',
  //         benefits: '<p>ssss</p>',
  //         location: {
  //           country: 'PH',
  //           state: 'Marulas',
  //           city: 'Valenzuela City',
  //           street: '32 T Conception St. Marulas Valenzuela City, Philippines',
  //           postalCode: 3223,
  //           timezone: 'Pacific/Rarotonga',
  //           useCandidateTimezone: true,
  //           remote: true,
  //         },
  //         employment: {
  //           type: '1',
  //           category: '2',
  //           qualification: '2',
  //           experience: '1',
  //           yearsOfExperience: 3,
  //           hours: {
  //             type: 'hours',
  //             min: 1,
  //             max: 3,
  //           },
  //           salary: {
  //             min: 1,
  //             max: 6,
  //             cycle: '1',
  //             currency: 'RSD',
  //           },
  //         },
  //       },
  //       formSubmission: {
  //         requiredFields: [
  //           {
  //             field: 'firstname',
  //             label: 'First Name / Full Name',
  //             priority: 'required',
  //             configurable: false,
  //             value: null,
  //           },
  //           {
  //             field: 'lastname',
  //             label: 'Last Name',
  //             priority: 'optional',
  //             configurable: false,
  //             value: null,
  //           },
  //           {
  //             field: 'email-address',
  //             label: 'Email Address',
  //             priority: 'required',
  //             configurable: false,
  //             value: null,
  //           },
  //           {
  //             field: 'contact-number',
  //             label: 'Contact Number',
  //             priority: 'required',
  //             configurable: true,
  //             value: {
  //               countryCallingCode: null,
  //               number: null,
  //             },
  //           },
  //           {
  //             field: 'cv',
  //             label: 'CV or resume',
  //             priority: 'required',
  //             configurable: true,
  //             value: null,
  //           },
  //           {
  //             field: 'cover-letter',
  //             label: 'Cover Letter',
  //             priority: 'required',
  //             configurable: true,
  //             value: null,
  //           },
  //           {
  //             field: 'photo',
  //             label: 'Photo',
  //             priority: 'required',
  //             configurable: true,
  //             value: null,
  //           },
  //         ],
  //       },
  //       sourcingTeam: {
  //         leadId: '',
  //         managerIds: [],
  //         memberIds: [],
  //       },
  //       sourcingStages: {
  //         stages: [
  //           {
  //             order: 1,
  //             state: 'start',
  //             type: 'sourced',
  //             title: 'Sourced',
  //             overdue: '7 days',
  //             ignoreAutomation: false,
  //             color: '#FFFFFF',
  //             actions: [
  //               {
  //                 expand: true,
  //                 type: 'add-note',
  //                 title: 'Add Note',
  //                 data: {
  //                   notes: null,
  //                   message: null,
  //                 },
  //               },
  //             ],
  //             id: null,
  //           },
  //           {
  //             order: 2,
  //             state: 'start',
  //             type: 'applied',
  //             title: 'Applied',
  //             overdue: '7 days',
  //             ignoreAutomation: true,
  //             color: '#FFFFFF',
  //             actions: [
  //               {
  //                 expand: true,
  //                 type: 'send-email',
  //                 title: 'Send Email',
  //                 data: {
  //                   notes: null,
  //                   message: '',
  //                 },
  //               },
  //             ],
  //             id: null,
  //           },
  //           {
  //             order: 3,
  //             state: 'start',
  //             type: 'applied',
  //             title: 'Hired',
  //             overdue: null,
  //             color: '#FFFFFF',
  //             ignoreAutomation: false,
  //             actions: [],
  //             id: null,
  //           },
  //         ],
  //       },
  //       shareSettings: {
  //         url: null,
  //         title: 'Java Developer',
  //         description: 'Some description',
  //         coverPhoto: '',
  //       },
  //     };
  //     let title = body.details.title;
  //     const totalOfExisting = await this.pipelines.find({ 'details.title': title, createdBy: tokenPayload.account, properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId, });

  //     console.log('totalOfExisting', totalOfExisting);

  //     if (!isEmpty(totalOfExisting)) {
  //       title = `${title} - ${DateTime.now().toFormat('X')}`;
  //     }

  //     const createdPipeline = await this.pipelines.create({
  //       // title: title,
  //       // description: body.details.description,
  //       // type: body.details.employment.type,
  //       // closingDate: body.closingDate,
  //       // quantity: body.quantity,
  //       // pipelineStages: [
  //       //   {
  //       //     order: 1,
  //       //     state: 'start',
  //       //     type: 'applied',
  //       //     name: 'Applied',
  //       //     overdue: null,
  //       //     color: '#FFFFFF',
  //       //     automatedAction: null,
  //       //     id: SYSTEM_ID(),
  //       //     leads: [],
  //       //   },
  //       // ],
  //       details: {
  //         ...body.details,
  //         title: title,
  //       },
  //       formSubmission: body.formSubmission,
  //       sourcingTeam: body.sourcingTeam,
  //       sourcingStages: body.sourcingStages,
  //       shareSettings: body.shareSettings,
  //       createdBy: tokenPayload.account,
  //       workspace: tokenPayload.workspace,
  //       workspaceSpace: tokenPayload.workspaceSpace,
  //       organization: tokenPayload.organization,
  //     });

  //     return ResponseHandlerService({
  //       success: true,
  //       httpCode: HttpStatus.OK,
  //       statusCode: STATUS_CODE.DATA_CREATED,
  //       message: 'Successfully created',
  //       data: createdPipeline,
  //     });
  //   } catch (error) {
  //     return ResponseHandlerService({
  //       success: false,
  //       httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
  //       statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
  //       message: 'Unable to process your data',
  //       errorDetails: error,
  //     });
  //   }
  // }

  public async update(pipelineId: string, body: any, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const lead = await this.pipelines.findOneAndUpdate(
        {
          _id: pipelineId,
          createdBy: tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        {
          $set: {
            details: body?.details,
            sourcingTeam: body?.sourcingTeam,
            sourcingPipeline: body?.sourcingPipeline,
          },
        },
        { new: true }
      );

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
        data: lead,
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

  public async updateStatus(pipelineId: string, body: UpdatePipelineStatusDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      this.pipelines
        .updateOne(
          { _id: pipelineId, properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId },
          { $set: { status: body.status } }
        )
        .then();
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

  public async delete(pipelineId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      this.pipelines.deleteOne({ _id: pipelineId, properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId }).then();
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully delete',
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

  // public async assignPipeline(pipelineId: string, body: AssignPipelinePipelineDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   try {
  //     const pipeline = await this.pipelines.findOne({
  //       _id: pipelineId,
  //       createdBy: tokenPayload.account,
  //       properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId,
  //       deleted: false,
  //     });

  //     const pipeline = await this.pipeline.findOne({
  //       _id: body.pipelineId,
  //       createdBy: tokenPayload.account,
  //       properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId,
  //       deleted: false,
  //     });

  //     if (isEmpty(pipeline) || isEmpty(pipeline) || !isEmpty(pipeline.pipelineStages)) {
  //       return ResponseHandlerService({
  //         success: false,
  //         httpCode: HttpStatus.NOT_FOUND,
  //         statusCode: STATUS_CODE.NOT_FOUND,
  //         message: 'No result(s) found',
  //       });
  //     }

  //     const stages = pipeline.stages.map((stage) => {
  //       stage.leads = [];
  //       return stage;
  //     });

  //     const updatedPipeline = await this.pipelines.findOneAndUpdate(
  //       {
  //         _id: pipelineId,
  //         createdBy: tokenPayload.account,
  //         properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId,
  //         deleted: false,
  //       },
  //       { $set: { pipeline: pipeline._id, pipelineStages: stages } },
  //       { new: true },
  //     );

  //     return ResponseHandlerService({
  //       success: true,
  //       httpCode: HttpStatus.OK,
  //       statusCode: STATUS_CODE.HAS_DATA,
  //       message: 'Successfully added',
  //       data: updatedPipeline,
  //     });
  //   } catch (error) {
  //     return ResponseHandlerService({
  //       success: false,
  //       httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
  //       statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
  //       message: 'Unable to process your data',
  //       errorDetails: error,
  //     });
  //   }
  // }

  public async sortPipelineStage(
    pipelineId: string,
    body: SortPipelineStagePipelineDTO,
    tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    try {
      // const pipeline = await this.pipelines.findOne({
      //   _id: pipelineId,
      //   createdBy: tokenPayload.accountId,
      //   properties: tokenPayload.propertyId,
      //   propertiesBranches: tokenPayload.branchId,
      //   deleted: false,
      // });

      // if (isEmpty(pipeline)) {
      //   return ResponseHandlerService({
      //     success: false,
      //     httpCode: HttpStatus.NOT_FOUND,
      //     statusCode: STATUS_CODE.NOT_FOUND,
      //     message: 'No result(s) found',
      //   });
      // }

      // const stage = {
      //   order: body.stage.order,
      //   state: body.stage.state,
      //   type: body.stage.type,
      //   title: body.stage.title,
      //   overdue: null,
      //   color: body.stage.color,
      //   actions: [],
      //   id: SYSTEM_ID(),
      //   ignoreAutomation: true,
      // };

      // const stages = body.stages.map((sortedStage, index) => {
      //   sortedStage['order'] = index;
      //   if (sortedStage.new) {
      //     sortedStage = stage as any;
      //   } else {
      //     sortedStage = pipeline.sourcingPipeline.stages.find((s) => s.id === sortedStage.id) as any;
      //   }
      //   return sortedStage;
      // });

      // await this.pipelines.findOneAndUpdate(
      //   {
      //     _id: pipelineId,
      //     createdBy: tokenPayload.accountId,
      //     properties: tokenPayload.propertyId,
      //     propertiesBranches: tokenPayload.branchId,
      //     deleted: false,
      //   },
      //   {
      //     $set: {
      //       'sourcingPipeline.stages': stages,
      //       $sort: { order: 1 },
      //     },
      //   },
      //   { new: true },
      // );

      // const pipelineInfo = await this.fetchById(pipelineId, tokenPayload);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        message: 'Successfully added',
        data: {
          // updatedPipeline: pipelineInfo.data,
          // stage: {
          //   ...stage,
          //   leads: [],
          // },
        },
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

  public async addPipelineStage(
    pipelineId: string,
    body: AddPipelineStagePipelineDTO,
    tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    try {
      const pipeline = await this.pipelines.findOne({
        _id: pipelineId,
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
        deleted: false,
      });

      if (isEmpty(pipeline)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      const stage = {
        order: body.stage.order,
        state: body.stage.state,
        type: body.stage.type,
        title: body.stage.title,
        overdue: null,
        color: body.stage.color,
        actions: [],
        id: SYSTEM_ID(),
        ignoreAutomation: true,
      };

      const stages = body.stages.map((sortedStage, index) => {
        sortedStage['order'] = index;
        if (sortedStage.new) {
          sortedStage = stage as any;
        } else {
          sortedStage = pipeline.sourcingPipeline.stages.find((s) => s.id === sortedStage.id) as any;
        }
        return sortedStage;
      });

      await this.pipelines.findOneAndUpdate(
        {
          _id: pipelineId,
          createdBy: tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        },
        {
          $set: {
            'sourcingPipeline.stages': stages,
            $sort: { order: 1 },
          },
        },
        { new: true }
      );

      const pipelineInfo = await this.fetchById(pipelineId, body, tokenPayload);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        message: 'Successfully added',
        data: {
          updatedPipeline: pipelineInfo.data,
          stage: {
            ...stage,
            leads: [],
          },
        },
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

  public async removePipelineStage(
    pipelineId: string,
    body: RemovePipelineStagePipelineDTO,
    tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    try {
      const pipeline = await this.pipelines.findOne({
        _id: pipelineId,
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
        deleted: false,
      });

      if (isEmpty(pipeline)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      // Remove stage
      await this.pipelines.updateOne(
        {
          _id: pipelineId,
          createdBy: tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        },
        {
          $pull: {
            'sourcingPipeline.stages': {
              id: body.removePipelineStageId,
            },
          },
        }
      );

      // const leadsInRemovedStage = pipeline.leads.filter((lead) => lead.stageId === body.removePipelineStageId);
      // const leadsReceiverMoveStage = pipeline.leads.filter((stage) => stage.id === body.receiverPipelineStageId).leads;
      // leadsReceiverMoveStage.push(...leadsInRemovedStage);
      // leadsReceiverMoveStage.map((lead, index) => {
      //   lead.order = index + 1;
      //   return lead;
      // });

      // await this.pipelines.updateMany(
      //   {
      //     _id: pipelineId,
      //     'leads.pipelineStageId': body.removePipelineStageId,
      //     createdBy: tokenPayload.account,
      //     properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId,
      //     deleted: false,
      //   },
      //   {
      //     $set: {
      //       'leads.$.pipelineStageId': body.receiverPipelineStageId,
      //     },
      //   },
      // );
      // // add lead to stage

      const toBeRemovePipelineCandidates = pipeline.items.filter((lead: PipelineLeadsItemI) => lead.pipelineStageId === body.removePipelineStageId);
      const leadIds = toBeRemovePipelineCandidates.map((lead) => lead.id);

      /* remove lead from previous stage */
      await this.pipelines.updateOne(
        {
          _id: pipelineId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        },
        {
          $pull: {
            leads: {
              id: { $in: leadIds },
            },
          },
        }
      );

      /* Set leads of removed stage in receiver */
      const toBeMoveCandidates = toBeRemovePipelineCandidates.map((lead: PipelineLeadsItemI) => {
        lead.pipelineStageId = body.receiverPipelineStageId;
        return lead;
      });

      console.log(JSON.stringify(toBeMoveCandidates, null, 2));

      await this.pipelines.findOneAndUpdate(
        {
          _id: pipelineId,
          // 'pipelineStages.id': body.pipelineStageId,
          // createdBy: tokenPayload.account,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        },
        {
          $addToSet: {
            leads: {
              $each: toBeMoveCandidates,
            },
            $sort: { order: 1 },
          },
        },
        { new: true }
      );

      const pipelineInfo = await this.fetchById(pipelineId, body, tokenPayload);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        message: 'Successfully added',
        data: pipelineInfo.data,
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

  public async updatePipelineStage(
    pipelineId: string,
    stageId: string,
    body: UpdatePipelineStagePipelineDTO,
    tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    try {
      await this.pipelines.updateOne(
        {
          _id: pipelineId,
          'sourcingPipeline.stages.id': stageId,
          createdBy: tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        },
        {
          $set: {
            'sourcingPipeline.stages.$.title': body.stage.title,
            'sourcingPipeline.stages.$.color': body.stage.color,
          },
        }
      );

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        message: 'Changes saved!',
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: { name: 'PipelineService.updatePipelineStage', details: error },
      });
    }
  }

  public async assignCandidates(
    pipelineId: string,
    body: AssignCandidatesPipelineDTO,
    tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    try {
      const pipeline = await this.pipelines.findOne({
        _id: pipelineId,
        // createdBy: tokenPayload.account,
        type: 'leads',
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
        deleted: false,
      });
      if (isEmpty(pipeline)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      // const pipelineStage = pipeline.sourcingPipeline.stages.find((stage) => stage.id === body.pipelineStageId);

      // const pipelineStageId = isEmpty(body.pipelineStageId) ? pipelineStage.id : body.pipelineStageId;

      const items = body.leadIds
        // .filter((cId) => !pipelineStage.leads.find((c) => c.id === cId))
        .map((cId, cIndex) => {
          const leadStage = {
            id: cId,
            disqualification: {
              disqualified: false,
              reason: null,
            },
            pipelineStageId: body.pipelineStageId,
            addedAt: DateTime.now().toISO(),
            addedBy: tokenPayload.accountId,
          };
          // pipeline.pipelineStages.forEach((stage) => {
          //   stage.leads.forEach((lead, index) => {
          //     if (cId === lead.id) {
          //       // lead.order = index;
          //       leadStage = lead;
          //     }
          //   });
          // });

          leadStage['order'] = cIndex;
          return leadStage;
        });

      // remove lead from previous stage
      await this.pipelines.updateOne(
        {
          _id: pipelineId,
          // createdBy: tokenPayload.account,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        },
        {
          $pull: {
            items: {
              id: { $in: body.leadIds },
            },
          },
        }
      );

      // add lead to stage
      await this.pipelines.updateOne(
        {
          _id: pipelineId,
          // 'pipelineStages.id': body.pipelineStageId,
          // createdBy: tokenPayload.account,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        },
        {
          $addToSet: {
            items: {
              $each: items,
            },
            $sort: { order: 1 },
          },
        }
      );

      const currentStage = pipeline.sourcingPipeline.stages.find((stage) => stage.id === body.pipelineStageId);
      console.log('currentStage', currentStage);
      items.forEach((lead) => {
        /* create a pipeline activity logs */
        this.pipelinesActivityLogs
          .create({
            type: 'assign-to-stage',
            message: `${currentStage.title}`,
            lead: lead.id,
            createdBy: tokenPayload.accountId,
            pipeline: pipelineId,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
          })
          .then();

        /* create a activity logs */
        this.activityLogs
          .create({
            action: 'assign-to-stage',
            message: currentStage.title,
            data: {
              pipelineId,
              pipelineStageId: currentStage.id,
            },
            createdBy: tokenPayload.accountId,
            student: lead.id,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
          })
          .then();

        /* mark the lead as won=true|false */
        this.accounts.findOneAndUpdate({ _id: lead.id, properties: tokenPayload.queryIds.propertyId }, { $set: { won: currentStage.won } }).then();

        this.accounts.findOne({ _id: lead.id }, { _id: 1, firstName: 1, lastName: 1, assignedTo: 1 }).then((value) => {
          /* notify assignee */
          const assignedTo: string = value.assignedTo as unknown as string;
          if (tokenPayload.accountId !== assignedTo && !isEmpty(value.assignedTo)) {
            this.notifications
              .create({
                actionType: 'lead-changes-in-pipeline',
                title: 'Your lead was updated',
                message: `Your team made some updates of your lead: ${value.firstName} ${value.lastName} to stage ${currentStage.title}`,
                data: {
                  pipelineId: pipelineId,
                  updatedBy: tokenPayload.accountId,
                },
                accounts: assignedTo,
                properties: tokenPayload.propertyId,
                propertiesBranches: tokenPayload.branchId,
              })
              .then();
          }

          /* if lead moved to won stage notify reception and admin */
          if (currentStage.won) {
            /* find admin and receptionist */
            this.accounts.find({ role: { $in: ['admin', 'receptionist'] } }, { _id: 1, firstName: 1, lastName: 1, assignedTo: 1 }).then((teams) => {
              teams.forEach((team) => {
                this.notifications
                  .create({
                    actionType: 'lead-changes-in-pipeline',
                    title: 'Wow, new lead was won',
                    message: `${team.firstName} ${team.lastName} won a lead: ${value.firstName} ${value.lastName}`,
                    data: {
                      pipelineId: pipelineId,
                      updatedBy: tokenPayload.accountId,
                    },
                    accounts: assignedTo,
                    properties: tokenPayload.propertyId,
                    propertiesBranches: tokenPayload.branchId,
                  })
                  .then();
              });
            });
          }
        });
      });

      const pipelineInfo = await this.fetchById(pipelineId, body, tokenPayload);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully added',
        data: pipelineInfo.data,
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

  public async unAssignCandidates(
    pipelineId: string,
    body: UnAssignCandidatesPipelineDTO,
    tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    try {
      const pipeline = await this.pipelines.findOne({
        _id: pipelineId,
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
        deleted: false,
      });

      if (isEmpty(pipeline)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      await this.pipelines.updateMany(
        {
          _id: pipelineId,
          createdBy: tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        },
        {
          $pull: {
            items: {
              id: { $in: body.leadIds },
            },
          },
        },
        { multi: true }
      );

      this.accounts.find({ _id: { $in: body.leadIds } }, { _id: 1, firstName: 1, lastName: 1, assignedTo: 1 }).then((values) => {
        values.forEach((value) => {
          if (tokenPayload.accountId !== (value.assignedTo as unknown as string)) {
            this.notifications
              .create({
                actionType: 'lead-changes-in-pipeline',
                title: 'Your lead was updated',
                message: `Your team remove your lead: ${value.firstName} ${value.lastName} from the pipeline`,
                data: {
                  pipelineId: pipelineId,
                  updatedBy: tokenPayload.accountId,
                },
                accounts: value.assignedTo,
                properties: tokenPayload.propertyId,
                propertiesBranches: tokenPayload.branchId,
              })
              .then();
          }
        });
      });

      const pipelineInfo = await this.fetchById(pipelineId, body, tokenPayload);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully removed',
        data: pipelineInfo.data,
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

  public async addNote(pipelineId: string, body: AddNoteDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdNotes = [];
      for await (const leadId of body.leadIds) {
        const createdNote = await this.pipelinesNotes.create({
          title: body.title,
          message: body.message,
          lead: leadId,
          createdBy: tokenPayload.accountId,
          pipeline: pipelineId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        });
        createdNotes.push(createdNote);

        await this.pipelinesActivityLogs.create({
          type: 'add-note',
          lead: leadId,
          createdBy: tokenPayload.accountId,
          pipeline: pipelineId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        });

        this.accounts.findOne({ _id: leadId }, { _id: 1, firstName: 1, lastName: 1, assignedTo: 1 }).then((value) => {
          if (tokenPayload.accountId !== (value.assignedTo as unknown as string)) {
            this.notifications
              .create({
                actionType: 'lead-changes-in-pipeline',
                title: 'Your lead was updated',
                message: `Your team leave a note on your lead: ${value.firstName} ${value.lastName}`,
                data: {
                  pipelineId: pipelineId,
                  updatedBy: tokenPayload.accountId,
                },
                accounts: value.assignedTo,
                properties: tokenPayload.propertyId,
                propertiesBranches: tokenPayload.branchId,
              })
              .then();
          }
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
        ...(createdNotes.length === 1 ? { data: createdNotes[0] } : null),
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

  public async fetchNotes(pipelineId: string, leadId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const notes = await this.pipelinesNotes
        .aggregate([
          {
            $match: {
              pipeline: pipelineId,
              lead: leadId,
              properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
              deleted: false,
            },
          },
          // {
          //   $lookup: {
          //     from: 'accounts',
          //     foreignField: '_id',
          //     localField: 'leadId',
          //     as: 'lead',
          //   },
          // },
          {
            $lookup: {
              from: 'accounts',
              // foreignField: '_id',
              // localField: 'createdBy',

              let: {
                ids: ['$createdBy'],
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $in: ['$_id', '$$ids'],
                    },
                  },
                },
                {
                  $project: {
                    firstName: 1,
                    lastName: 1,
                  },
                },
              ],
              as: 'createdBy',
            },
          },
          {
            $unwind: '$createdBy',
          },
        ])
        .sort({ createdAt: -1 });

      if (isEmpty(notes)) {
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
        data: notes,
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

  public async addConversations(pipelineId: string, body: AddConversationDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdConversation = await this.pipelinesConversations.create({
        message: body.message,
        createdBy: tokenPayload.accountId,
        lead: body.leadId,
        pipeline: pipelineId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      this.accounts.findOne({ _id: body.leadId }, { _id: 1, firstName: 1, lastName: 1, assignedTo: 1 }).then((value) => {
        if (tokenPayload.accountId !== (value.assignedTo as unknown as string)) {
          this.notifications
            .create({
              actionType: 'lead-changes-in-pipeline',
              title: 'Your lead was updated',
              message: `Your team leave a message on your lead: ${value.firstName} ${value.lastName}`,
              data: {
                pipelineId: pipelineId,
                updatedBy: tokenPayload.accountId,
              },
              accounts: value.assignedTo,
              properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
            })
            .then();
        }
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
        data: createdConversation,
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

  public async fetchConversations(pipelineId: string, leadId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const conversations = await this.pipelinesConversations
        .aggregate([
          {
            $match: {
              pipeline: pipelineId,
              lead: leadId,
              properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
              deleted: false,
            },
          },
          {
            $lookup: {
              from: 'accounts',
              let: {
                ids: ['$createdBy'],
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $in: ['$_id', '$$ids'],
                    },
                  },
                },
                {
                  $project: {
                    firstName: 1,
                    lastName: 1,
                  },
                },
              ],
              as: 'createdBy',
            },
          },
          {
            $unwind: '$createdBy',
          },
        ])
        .sort({ createdAt: 1 });

      if (isEmpty(conversations)) {
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
        data: conversations,
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

  public async fetchActivityLogs(pipelineId: string, leadId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const activityLogs = await this.pipelinesActivityLogs
        .aggregate([
          {
            $match: {
              pipeline: pipelineId,
              lead: leadId,
              properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
              deleted: false,
            },
          },
          {
            $lookup: {
              from: 'accounts',
              let: {
                ids: ['$createdBy'],
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $in: ['$_id', '$$ids'],
                    },
                  },
                },
                {
                  $project: {
                    firstName: 1,
                    lastName: 1,
                  },
                },
              ],
              as: 'createdBy',
            },
          },
          {
            $unwind: '$createdBy',
          },
        ])
        .sort({ createdAt: 1 });

      if (isEmpty(activityLogs)) {
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
        data: activityLogs,
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

  public async manageTaskInTaskPipeline(
    pipelineId: string,
    body: ManageTaskInTaskPipelineDTO,
    tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    try {
      let update;

      if (body.action === 'add') {
        update = this.pipelines.findOneAndUpdate(
          {
            _id: pipelineId,
            type: 'task',
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
            deleted: false,
          },
          {
            $push: {
              items: {
                id: SYSTEM_ID(),
                stageId: body.stagesIds.currentStageId,
                name: body.name,
                notes: body.notes,
              },
            },
          },
          { new: true }
        );
      }

      if (body.action === 'edit') {
        update = this.pipelines.findOneAndUpdate(
          {
            _id: pipelineId,
            type: 'task',
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
            'items.id': body.stagesIds.taskId,
            deleted: false,
          },
          {
            $set: {
              'items.$.name': body.name,
              'items.$.notes': body.notes,
            },
          },
          { new: true }
        );
      }

      if (body.action === 'move') {
        update = this.pipelines.findOneAndUpdate(
          {
            _id: pipelineId,
            type: 'task',
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
            'items.id': body.stagesIds.taskId,
            deleted: false,
          },
          {
            $set: {
              'items.$.stageId': body.stagesIds.moveToStageId,
            },
          },
          { new: true }
        );
      }

      const data = await update;

      if (isEmpty(data)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: `Unable to ${body.action} task, pipeline not found. please try again`,
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: `Task ${body.action}ed successfully`,
        data,
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

  public async deleteTaskInTaskPipeline(
    pipelineId: string,
    query: DeleteTaskInTaskPipelineDTO,
    tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    try {
      const result = await this.pipelines.updateOne(
        {
          _id: pipelineId,
          type: 'task',
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        },
        {
          $pull: {
            items: {
              id: query.taskId,
            },
          },
        }
      );

      if (result.modifiedCount === 0 && result.matchedCount === 0) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'Unable to process your request, resource not found or already deleted',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Task deleted successfully',
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
