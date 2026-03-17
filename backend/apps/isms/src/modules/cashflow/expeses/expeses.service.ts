import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateExpenseDTO } from './dto';
import { IResponseHandlerParams, ResponseHandlerService, Cashflow, STATUS_CODE, IAuthTokenPayload, QueryDTO, ActivityLogs } from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { isArray, isEmpty } from 'lodash';

@Injectable()
export class ExpensesService {
  constructor(@InjectModel(Cashflow) private readonly cashflow: ReturnModelType<typeof Cashflow>, @InjectModel(ActivityLogs) private readonly activityLogs: ReturnModelType<typeof ActivityLogs>) {}

  public async create(body: CreateExpenseDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const cashflow = await this.cashflow.create({
        amount: body.amount,
        notes: body.notes,
        payedBy: null,
        receivedBy: tokenPayload.accountId,
        mode: body.mode,
        type: 'expense',
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      this.activityLogs
        .create({
          action: 'expense',
          createdBy: tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        })
        .then();

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Expense was added',
        data: cashflow,
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

  public async fetch(query: QueryDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const cashflow = await this.cashflow
        .aggregate([
          {
            $match: {
              type: 'expense',
              properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
              deleted: false,
              ...(query.staffs
                ? {
                    receivedBy: {
                      $in: isArray(query.staffs) ? query.staffs : [query.staffs],
                    },
                  }
                : null),
              createdAt: {
                $gte: new Date(query.startEndDate[0]),
                $lte: new Date(query.startEndDate[1]),
              },
            },
          },
          {
            $lookup: {
              from: 'accounts',
              localField: 'receivedBy',
              foreignField: '_id',
              as: 'receivedBy',
            },
          },
          { $unwind: '$receivedBy' },
        ])
        .sort({ createdAt: -1 });

      // .populate([
      //   {
      //     path: 'payedBy',
      //     model: Accounts,
      //     select: { _id: 1, firstName: 1, lastName: 1 },
      //   },
      //   {
      //     path: 'receivedBy',
      //     model: Accounts,
      //     select: { _id: 1, firstName: 1, lastName: 1 },
      //   },
      // ])
      // .sort({ createdAt: -1 });

      if (isEmpty(cashflow)) {
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
        data: cashflow,
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

  public async softDelete(materialId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.cashflow.updateOne(
        {
          _id: materialId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        { deleted: true },
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Material has been deleted',
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
