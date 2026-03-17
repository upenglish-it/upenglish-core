import { HttpStatus, Injectable } from '@nestjs/common';
import {
  IResponseHandlerParams,
  ResponseHandlerService,
  STATUS_CODE,
  IAuthTokenPayload,
  // Schedules
} from 'apps/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { isEmpty } from 'lodash';
import { CreateScheduleDTO, UpdateScheduleDTO } from './dto';

@Injectable()
export class SchedulesService {
  // constructor(@InjectModel(Schedules) private readonly schedules: ReturnModelType<typeof Schedules>) {}

  public async fetch(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      // const schedules = await this.schedules
      //   .aggregate([
      //     {
      //       $match: {
      //         properties: tokenPayload.propertyId,
      //         // propertiesBranches: tokenPayload.branchId,
      //         deleted: false,
      //       },
      //     },
      //     {
      //       $lookup: {
      //         from: 'schedules-shifts',
      //         foreignField: 'schedules',
      //         localField: '_id',
      //         as: 'schedulesShifts',
      //         pipeline: [
      //           {
      //             $lookup: {
      //               from: 'classes',
      //               localField: 'classes',
      //               foreignField: '_id',
      //               as: 'classes',
      //             },
      //           },
      //           { $unwind: '$classes' },
      //           {
      //             $lookup: {
      //               from: 'schedules',
      //               localField: 'schedules',
      //               foreignField: '_id',
      //               as: 'schedules',
      //             },
      //           },
      //           { $unwind: '$schedules' },
      //           // {
      //           //   $lookup: {
      //           //     from: 'accounts',
      //           //     localField: 'staff',
      //           //     foreignField: '_id',
      //           //     as: 'staff',
      //           //   },
      //           // },
      //           // { $unwind: '$staff' },
      //           {
      //             $lookup: {
      //               from: 'accounts',
      //               localField: 'careTaker',
      //               foreignField: '_id',
      //               as: 'careTaker',
      //             },
      //           },
      //           { $unwind: '$careTaker' },

      //           // notes
      //           // {
      //           //   $lookup: {
      //           //     // from: 'accounts',
      //           //     // localField: 'notes.accountId',
      //           //     // foreignField: '_id',
      //           //     // as: 'notes',
      //           //     ///
      //           //     from: 'accounts',
      //           //     foreignField: '_id',
      //           //     localField: 'notes.accountId',
      //           //     // let: {
      //           //     //   nnotes: '$notes.notes',
      //           //     // },
      //           //     let: { pid: '$notes.accountId' },
      //           //     pipeline: [
      //           //       { $match: { $expr: { $in: ['$_id', '$$pid'] } } },
      //           //       {
      //           //         $project: {
      //           //           _id: 1,
      //           //           firstName: 1,
      //           //           lastName: 1,
      //           //           // notes: '$$nnotes',
      //           //           // date: '$date',
      //           //         },
      //           //       },
      //           //     ],
      //           //     as: 'notes',
      //           //   },
      //           // },
      //         ],
      //       },
      //     },
      //   ])
      //   .sort({
      //     order: -1,
      //   });

      // if (isEmpty(schedules)) {
      //   return ResponseHandlerService({
      //     success: false,
      //     httpCode: HttpStatus.NOT_FOUND,
      //     statusCode: STATUS_CODE.NOT_FOUND,
      //     message: 'No result(s) found',
      //   });
      // }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        // data: schedules,
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
      // const schedule = await this.schedules.aggregate([
      //   {
      //     $match: {
      //       _id: id,
      //       properties: tokenPayload.propertyId,
      //       // propertiesBranches: tokenPayload.branchId,
      //       // deleted: false,
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: 'schedules-shifts',
      //       foreignField: 'schedules',
      //       localField: '_id',
      //       as: 'schedulesShifts',
      //       pipeline: [
      //         {
      //           $lookup: {
      //             from: 'accounts',
      //             localField: 'staff',
      //             foreignField: '_id',
      //             as: 'staff',
      //           },
      //         },
      //         { $unwind: '$staff' },
      //         {
      //           $lookup: {
      //             from: 'accounts',
      //             localField: 'careTaker',
      //             foreignField: '_id',
      //             as: 'careTaker',
      //           },
      //         },
      //         { $unwind: '$careTaker' },
      //       ],
      //     },
      //   },
      // ]);

      // if (isEmpty(schedule)) {
      //   return ResponseHandlerService({
      //     success: false,
      //     httpCode: HttpStatus.NOT_FOUND,
      //     statusCode: STATUS_CODE.NOT_FOUND,
      //     message: 'No result(s) found',
      //   });
      // }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        // data: schedule[0],
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

  public async create(body: CreateScheduleDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      // const schedules = await this.schedules.create({
      //   title: body.title,
      //   time: body.time,
      //   schedule: body.schedule,
      //   order: 1,
      //   createdBy: tokenPayload.accountId,
      //   properties: tokenPayload.propertyId,
      //   propertiesBranches: tokenPayload.branchId,
      // });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
        // data: schedules,
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

  public async updateById(id: string, body: UpdateScheduleDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      // const schedule = await this.schedules.findOneAndUpdate(
      //   {
      //     _id: id,
      //     properties: tokenPayload.propertyId,
      //   },
      //   {
      //     title: body.title,
      //     time: body.time,
      //     schedule: body.schedule,
      //   },
      // );

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully updated',
        // data: schedule,
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

  // public async setPrimary(id: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   try {
  //     await this.propertiesBranches.updateMany(
  //       {
  //         properties: tokenPayload.propertyId,
  //       },
  //       {
  //         primary: false,
  //       },
  //     );

  //     const updatedPropertyBranch = await this.propertiesBranches.findOneAndUpdate(
  //       {
  //         _id: id,
  //         properties: tokenPayload.propertyId,
  //       },
  //       {
  //         primary: true,
  //       },
  //     );

  //     return ResponseHandlerService({
  //       success: true,
  //       httpCode: HttpStatus.OK,
  //       statusCode: STATUS_CODE.DATA_UPDATED,
  //       message: 'Branch was updated successfully',
  //       data: updatedPropertyBranch,
  //     });
  //   } catch (error) {
  //
  //     return ResponseHandlerService({
  //       success: false,
  //       httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
  //       statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
  //       message: 'Unable to process your data',
  //       errorDetails: error,
  //     });
  //   }
  // }

  // public async delete(id: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   try {
  //     this.propertiesBranches
  //       .findOneAndUpdate(
  //         {
  //           _id: id,
  //           properties: tokenPayload.propertyId,
  //         },
  //         {
  //           deleted: true,
  //         },
  //       )
  //       .then();
  //     return ResponseHandlerService({
  //       success: true,
  //       httpCode: HttpStatus.OK,
  //       statusCode: STATUS_CODE.DATA_DELETED,
  //       message: 'Branch was deleted',
  //     });
  //   } catch (error) {
  //
  //     return ResponseHandlerService({
  //       success: false,
  //       httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
  //       statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
  //       message: 'Unable to process your data',
  //       errorDetails: error,
  //     });
  //   }
  // }

  // public async undo(id: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   try {
  //     this.propertiesBranches
  //       .findOneAndUpdate(
  //         {
  //           _id: id,
  //           properties: tokenPayload.propertyId,
  //         },
  //         {
  //           deleted: false,
  //         },
  //       )
  //       .then();

  //     return ResponseHandlerService({
  //       success: true,
  //       httpCode: HttpStatus.OK,
  //       statusCode: STATUS_CODE.DATA_DELETED,
  //       message: 'Branch was recovered',
  //     });
  //   } catch (error) {
  //
  //     return ResponseHandlerService({
  //       success: false,
  //       httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
  //       statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
  //       message: 'Unable to process your data',
  //       errorDetails: error,
  //     });
  //   }
  // }

  // public async switch(body: SwitchBranchDTO, tokenPayload: IAuthTokenPayload, request: Request): Promise<IResponseHandlerParams> {
  //   try {
  //     const branchId = body.branchId;

  //     const composeAuthorizationToken = GENERATE_AUTHORIZATION_TOKEN({
  //       payload: {
  //         accountId: tokenPayload.accountId,
  //         propertyId: tokenPayload.propertyId,
  //         ...(body?.branchId ? { branchId: branchId } : null),
  //         queryIds: {
  //           propertyId: tokenPayload.propertyId,
  //           ...(body?.branchId ? { branchId: branchId } : null),
  //         },
  //       },
  //       device: {
  //         source: request.headers['user-agent'],
  //       },
  //       interval: {
  //         expireAt: DateTime.now()
  //           .plus({
  //             hours: 24,
  //           })
  //           .toISO(),
  //       },
  //     });

  //     return ResponseHandlerService({
  //       success: true,
  //       httpCode: HttpStatus.OK,
  //       statusCode: STATUS_CODE.DATA_UPDATED,
  //       message: 'Branch was switched',
  //       data: {
  //         authorizationToken: composeAuthorizationToken,
  //         ...(body?.branchId ? { selectedBranch: branchId } : null),
  //       },
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
}
