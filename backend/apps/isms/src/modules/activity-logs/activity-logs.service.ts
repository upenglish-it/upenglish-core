import { HttpStatus, Injectable } from '@nestjs/common';
import { IResponseHandlerParams, ResponseHandlerService, ActivityLogs, STATUS_CODE, IAuthTokenPayload } from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { isEmpty } from 'lodash';

@Injectable()
export class ActivityLogsService {
  constructor(@InjectModel(ActivityLogs) private readonly activityLogs: ReturnModelType<typeof ActivityLogs>) {}

  public async fetch(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const activityLogs = await this.activityLogs
        .aggregate([
          {
            $match: {
              properties: tokenPayload.propertyId,
              ...(tokenPayload.queryIds.branchId ? { propertiesBranches: tokenPayload.branchId } : null),
              deleted: false,
            },
          },

          /* Created By */
          {
            $lookup: {
              from: 'accounts',
              localField: 'createdBy',
              foreignField: '_id',
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    firstName: 1,
                    lastName: 1,
                    profilePhoto: 1,
                  },
                },
              ],
              as: 'createdBy',
            },
          },
          {
            $unwind: {
              path: '$createdBy',
              preserveNullAndEmptyArrays: true,
            },
          },

          /* Students */
          {
            $lookup: {
              from: 'accounts',
              localField: 'student',
              foreignField: '_id',
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    firstName: 1,
                    lastName: 1,
                    profilePhoto: 1,
                  },
                },
              ],
              as: 'student',
            },
          },
          {
            $unwind: {
              path: '$student',
              preserveNullAndEmptyArrays: true,
            },
          },
        ])
        .limit(35)
        .sort({ createdAt: -1 });

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
}
