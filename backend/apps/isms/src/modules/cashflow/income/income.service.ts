import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateIncomeDTO } from './dto';
import { IAuthTokenPayload, IResponseHandlerParams, ResponseHandlerService, ActivityLogs, Cashflow, Materials, Notifications, StudentsTuitionAttendance, STATUS_CODE, QueryDTO } from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { isArray, isEmpty } from 'lodash';

@Injectable()
export class IncomeService {
  constructor(
    @InjectModel(Cashflow) private readonly cashflow: ReturnModelType<typeof Cashflow>,
    @InjectModel(StudentsTuitionAttendance) private readonly studentsTuitionAttendance: ReturnModelType<typeof StudentsTuitionAttendance>,
    @InjectModel(Materials) private readonly materials: ReturnModelType<typeof Materials>,
    @InjectModel(Notifications) private readonly notifications: ReturnModelType<typeof Notifications>,
    // @Inject(forwardRef(() => StudentsTuitionAttendanceService)) private studentsTuitionAttendanceService: StudentsTuitionAttendanceService,
    @InjectModel(ActivityLogs) private readonly activityLogs: ReturnModelType<typeof ActivityLogs>,
  ) {}

  public async create(body: CreateIncomeDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      // if someone buy a material

      let totalAmount = body.amount * body.quantity;
      let materialName = null;

      if (!isEmpty(body.materialId)) {
        const material = await this.materials.findOneAndUpdate(
          { _id: body.materialId, deleted: false },
          {
            $inc: { quantity: -Math.abs(body.quantity) },
          },
          { new: true },
        );

        if (isEmpty(material)) {
          return ResponseHandlerService({
            success: false,
            httpCode: HttpStatus.NOT_FOUND,
            statusCode: STATUS_CODE.NOT_FOUND,
            message: 'No result(s) found',
          });
        }

        // cashflowCreateData = {
        //   material: {
        //     materials: body.material.materials,
        //     quantity: body.material.quantity,
        //   },
        //   amount: material.price,
        // };
        totalAmount = material.price * body.quantity;
        materialName = material.name;
      }

      const cashflow = await this.cashflow.create({
        notes: body.notes,
        payedBy: body.studentId,
        receivedBy: tokenPayload.accountId,
        amount: totalAmount,
        quantity: body.quantity,
        ...(body.materialId
          ? {
              material: {
                material: body.materialId,
                materialName: materialName,
                quantity: body.quantity,
              },
            }
          : null),
        mode: body.mode,
        type: 'income',
        from: body.from,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      this.activityLogs
        .create({
          action: 'receive-payment-from-material',
          createdBy: tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        })
        .then();

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Income was added',
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

  public async update(materialId: string, body: CreateIncomeDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const material = await this.cashflow.findOneAndUpdate(
        {
          _id: materialId,
        },
        {
          // name: body.name,
          // price: body.price,
          // quantity: body.quantity,
        },
        { new: true },
      );
      if (isEmpty(material)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Income was updated successfully',
        data: material,
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
      const incomeQuery = [
        {
          $match: {
            type: 'income',
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
        // {
        //   $lookup: {
        //     from: 'accounts',
        //     let: {
        //       id: ['$receivedBy'],
        //     },
        //     pipeline: [
        //       {
        //         $match: {
        //           _id: '$$id',
        //         },
        //       },
        //       {
        //         $project: {
        //           firstName: 1,
        //           lastName: 1,
        //         },
        //       },
        //     ],
        //     as: 'receivedBy',
        //   },
        // },
      ];

      console.log('incomeQuery', incomeQuery);

      const cashflow = await this.cashflow
        .aggregate(incomeQuery)
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
        //   {
        //     path: 'material.materials',
        //     model: Materials,
        //     select: { _id: 1, name: 1 },
        //   },
        //   {
        //     path: 'tuition.tuitionAttendance',
        //     model: StudentsTuitionAttendance,
        //     select: { _id: 1, classes: 1 },
        //     populate: {
        //       path: 'classes',
        //       model: Classes,
        //       select: { _id: 1, courses: 1, name: 1 },
        //       populate: [
        //         {
        //           path: 'courses',
        //           model: Courses,
        //           select: { _id: 1, name: 1, initialName: 1 },
        //         },
        //       ],
        //     },
        //   },
        // ])
        .sort({ createdAt: -1 });

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

  public async fetchByTransactionId(transactionId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const cashflow = await this.cashflow.findOne({
        transactionId: transactionId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
        deleted: false,
      });
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
      //   {
      //     path: 'material.materials',
      //     model: Materials,
      //     select: { _id: 1, name: 1 },
      //   },
      //   {
      //     path: 'tuition.tuitionAttendance',
      //     model: StudentsTuitionAttendance,
      //     select: { _id: 1, classes: 1 },
      //     populate: {
      //       path: 'classes',
      //       model: Classes,
      //       select: { _id: 1, courses: 1 },
      //       populate: [
      //         {
      //           path: 'courses',
      //           model: Courses,
      //           select: { _id: 1, name: 1, initialName: 1 },
      //         },
      //       ],
      //     },
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
        message: 'Income has been deleted',
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
