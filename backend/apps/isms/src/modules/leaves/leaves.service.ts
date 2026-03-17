import { HttpStatus, Injectable } from '@nestjs/common';
import { IResponseHandlerParams, ResponseHandlerService, STATUS_CODE, IAuthTokenPayload, Leaves } from 'apps/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { isEmpty } from 'lodash';
import { ActionLeaveRequestDTO, RequestLeaveDTO } from './dto';

@Injectable()
export class LeavesService {
  constructor(@InjectModel(Leaves) private readonly leaves: ReturnModelType<typeof Leaves>) {}

  public async fetchRequest(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const leaves = await this.leaves
        .aggregate([
          {
            $match: {
              properties: tokenPayload.propertyId,
            },
          },
          {
            $lookup: {
              from: 'accounts',
              localField: 'staff',
              foreignField: '_id',
              pipeline: [
                {
                  $project: {
                    firstName: 1,
                    lastName: 1,
                    profilePhoto: 1,
                    emailAddresses: 1,
                  },
                },
              ],
              as: 'staff',
            },
          },
          {
            $unwind: '$staff',
          },
        ])
        .sort({
          createdAt: -1,
        });

      if (isEmpty(leaves)) {
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
        data: leaves,
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

  public async fetchStaffRequest(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const leaves = await this.leaves.find({ staff: tokenPayload.accountId, properties: tokenPayload.propertyId }).sort({
        createdAt: -1,
      });

      if (isEmpty(leaves)) {
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
        data: leaves,
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

  public async addStaffRequest(body: RequestLeaveDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const leaves = await this.leaves.create({
        staff: tokenPayload.accountId,
        dates: body.dates,
        notes: body.notes,
        type: body.type,
        hours: body.hours,
        payable: body.payable,
        properties: tokenPayload.queryIds.propertyId,
        propertiesBranches: tokenPayload.queryIds.branchId,
      });
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
        data: leaves,
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

  public async action(body: ActionLeaveRequestDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const leaves = await this.leaves.findOneAndUpdate(
        {
          _id: body.leaveId,
          properties: tokenPayload.queryIds.propertyId,
        },
        { status: body.status, approvalNotes: body.notes },
        { new: true },
      );

      if (isEmpty(leaves)) {
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
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully updated',
        data: leaves,
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
