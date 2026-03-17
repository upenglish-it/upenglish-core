import { HttpStatus, Injectable } from '@nestjs/common';
import {
  IResponseHandlerParams,
  ResponseHandlerService,
  STATUS_CODE,
  IAuthTokenPayload,
  StaffsSalaryPayment,
  StudentsTuitionAttendance,
  Cashflow,
} from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { isEmpty } from 'lodash';

@Injectable()
export class ProfOfPaymentService {
  constructor(
    @InjectModel(StaffsSalaryPayment) private readonly staffsSalaryPayment: ReturnModelType<typeof StaffsSalaryPayment>,
    @InjectModel(StudentsTuitionAttendance) private readonly studentsTuitionAttendance: ReturnModelType<typeof StudentsTuitionAttendance>,
    @InjectModel(Cashflow) private readonly cashflow: ReturnModelType<typeof Cashflow>
  ) {}

  public async fetchStudentReceipt(urlCode: string): Promise<IResponseHandlerParams> {
    try {
      const studentsTuitionAttendance = await this.studentsTuitionAttendance.aggregate([
        {
          $match: {
            paymentHistory: {
              $elemMatch: {
                urlCode: urlCode,
              },
            },
          },
        },

        {
          $project: {
            student: 1,
            paymentHistory: {
              $filter: {
                input: '$paymentHistory',
                as: 'history',
                cond: {
                  $eq: ['$$history.urlCode', urlCode],
                },
              },
            },
          },
        },

        {
          $unwind: {
            path: '$paymentHistory',
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $lookup: {
            from: 'classes',
            localField: 'paymentHistory.data.schedulesShift.classes',
            foreignField: '_id',
            as: 'class',
          },
        },
        { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: 'accounts',
            localField: 'student',
            foreignField: '_id',
            as: 'account',
          },
        },
        {
          $unwind: '$account',
        },
        {
          $project: {
            class: { name: 1 },
            account: {
              firstName: 1,
              lastName: 1,
              birthDate: 1,
              address: 1,
              cmnd: 1,
            },
            paymentHistory: 1,
          },
        },
      ]);

      if (isEmpty(studentsTuitionAttendance)) {
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
        data: studentsTuitionAttendance[0],
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

  public async fetchStaffPayslip(urlCode: string): Promise<IResponseHandlerParams> {
    try {
      const studentsTuitionAttendance = await this.staffsSalaryPayment.aggregate([
        {
          $match: {
            urlCode: urlCode,
          },
        },
        {
          $lookup: {
            from: 'accounts',
            localField: 'staff',
            foreignField: '_id',
            as: 'account',
          },
        },
        {
          $unwind: '$account',
        },
        {
          $lookup: {
            from: 'staffs-employment-information',
            localField: 'staff',
            foreignField: 'staff',
            as: 'staffsEmploymentInformation',
          },
        },
        {
          $unwind: '$staffsEmploymentInformation',
        },
        {
          $project: {
            account: {
              firstName: 1,
              lastName: 1,
              birthDate: 1,
              address: 1,
              cmnd: 1,
            },
            staffsEmploymentInformation: {
              position: 1,
            },
            dateIssued: 1,
            workStartDate: 1,
            workEndDate: 1,
            absences: 1,
            basicSalary: 1,
            dailySalary: 1,
            consultingCommission: 1,
            consultingCommissionQuantity: 1,
            hourlyTeachingRate: 1,
            hourlyTeachingRateQuantity: 1,
            hourlyTutoringRate: 1,
            hourlyTutoringRateQuantity: 1,
            hourlyTAPARate: 1,
            hourlyTAPARateQuantity: 1,
            insuranceAmount: 1,
            employeePay: 1,
            companyPay: 1,
            urlCode: 1,
            transactionId: 1,
            salaryAdvancement: 1,
            salaryAdvancementLoanedAmount: 1,
            salaryAdvancementAmountPay: 1,
            salaryAdvancementBalance: 1,
            totalOfUnpaidHours: 1,
            totalAmountOfUnpaidHours: 1,
            totalStaffSalary: 1,
          },
        },
      ]);

      if (isEmpty(studentsTuitionAttendance)) {
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
        data: studentsTuitionAttendance[0],
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

  public async fetchCashflowByTransactionId(transactionId: string): Promise<IResponseHandlerParams> {
    try {
      const cashflow = await this.cashflow.aggregate([
        {
          $match: {
            deleted: false,
            transactionId: transactionId,
          },
        },

        {
          $lookup: {
            from: 'accounts',
            let: {
              receivedBy: '$receivedBy',
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ['$_id', '$$receivedBy'],
                      },
                    ],
                  },
                },
              },
              {
                $project: {
                  firstName: 1,
                  lastName: 1,
                  birthDate: 1,
                  address: 1,
                  cmnd: 1,
                },
              },
            ],
            as: 'receivedBy',
          },
        },

        {
          $unwind: {
            path: '$receivedBy',
            preserveNullAndEmptyArrays: true,
          },
        },
        ////////////
        // {
        //   $lookup: {
        //     from: 'accounts',
        //     localField: 'payedBy',
        //     foreignField: '_id',
        //     as: 'account',
        //   },
        // },
        {
          $lookup: {
            from: 'accounts',
            let: {
              payedBy: '$payedBy',
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ['$_id', '$$payedBy'],
                      },
                    ],
                  },
                },
              },
              {
                $project: {
                  firstName: 1,
                  lastName: 1,
                  birthDate: 1,
                  address: 1,
                  cmnd: 1,
                },
              },
            ],
            as: 'payedBy',
          },
        },
        {
          $unwind: { path: '$payedBy', preserveNullAndEmptyArrays: true },
        },
        // {
        //   $project: {
        //     account: {
        //       firstName: 1,
        //       lastName: 1,
        //       birthDate: 1,
        //       address: 1,
        //     },
        //     paymentHistory: 1,
        //   },
        // },
      ]);

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
        data: cashflow[0],
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
