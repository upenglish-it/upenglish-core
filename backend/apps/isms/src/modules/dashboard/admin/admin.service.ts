import { HttpStatus, Injectable } from '@nestjs/common';
import { IResponseHandlerParams, ResponseHandlerService, STATUS_CODE, IAuthTokenPayload, Accounts, StaffsEmploymentInformation, Cashflow } from 'apps/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';

@Injectable()
export class DashboardAdminService {
  constructor(
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,
    @InjectModel(StaffsEmploymentInformation) private readonly staffsEmploymentInformation: ReturnModelType<typeof StaffsEmploymentInformation>,
    @InjectModel(Cashflow) private readonly cashflow: ReturnModelType<typeof Cashflow>,
  ) {}

  public async fetchStatistics(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      // const students = await this.accounts.count({
      //   properties: tokenPayload.propertyId,
      //   propertiesBranches: tokenPayload.branchId,
      // });

      const statistics = await Promise.allSettled([
        /* Students */
        this.accounts.count({
          role: 'student',
          official: true,
          properties: tokenPayload.propertyId,
          ...(tokenPayload.queryIds.branchId ? { propertiesBranches: tokenPayload.branchId } : null),
        }),

        /* Staffs */
        this.accounts.count({
          role: { $in: ['admin', 'teacher', 'receptionist', 'marketing'] },
          properties: tokenPayload.propertyId,
          ...(tokenPayload.queryIds.branchId ? { propertiesBranches: tokenPayload.branchId } : null),
        }),

        /* Leads */
        this.accounts.count({
          role: 'student',
          official: false,
          won: false,
          properties: tokenPayload.propertyId,
          ...(tokenPayload.queryIds.branchId ? { propertiesBranches: tokenPayload.branchId } : null),
        }),

        /* Won leads */
        this.accounts.count({
          role: 'student',
          won: true,
          properties: tokenPayload.propertyId,
          ...(tokenPayload.queryIds.branchId ? { propertiesBranches: tokenPayload.branchId } : null),
        }),

        /* Income And Expense */
        this.cashflow.aggregate([
          {
            $match: {
              properties: tokenPayload.propertyId,
              ...(tokenPayload.queryIds.branchId ? { propertiesBranches: tokenPayload.branchId } : null),
              deleted: false,
            },
          },
          {
            $group: {
              _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
              income: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0],
                },
              },
              expense: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0],
                },
              },
            },
          },
        ]),

        /* Students - Male/Female */
        this.accounts.count({
          role: 'student',
          gender: 'male',
          official: true,
          properties: tokenPayload.propertyId,
          ...(tokenPayload.queryIds.branchId ? { propertiesBranches: tokenPayload.branchId } : null),
        }),
        this.accounts.count({
          role: 'student',
          gender: 'female',
          official: true,
          properties: tokenPayload.propertyId,
          ...(tokenPayload.queryIds.branchId ? { propertiesBranches: tokenPayload.branchId } : null),
        }),
      ]);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: {
          students: statistics[0].status === 'fulfilled' ? statistics[0].value : 0,
          staffs: statistics[1].status === 'fulfilled' ? statistics[1].value : 0,
          leads: statistics[2].status === 'fulfilled' ? statistics[2].value : 0,
          wonLeads: statistics[3].status === 'fulfilled' ? statistics[3].value : 0,
          incomeAndExpense: statistics[4].status === 'fulfilled' ? statistics[4].value : 0,
          maleStudent: statistics[5].status === 'fulfilled' ? statistics[5].value : 0,
          femaleStudent: statistics[6].status === 'fulfilled' ? statistics[6].value : 0,
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

  public async fetchBirthdaysByMonth(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const currentDate = DateTime.now();
      const accounts = await this.accounts.aggregate([
        {
          $addFields: {
            convertedDate: { $toDate: '$birthDate' },
          },
        },
        {
          $addFields: {
            birthMonth: {
              $month: { date: '$convertedDate' },
            },
          },
        },
        {
          $match: {
            birthMonth: { $eq: currentDate.month },
            role: {
              $in: ['teacher', 'receptionist', 'marketing'],
            },
            properties: tokenPayload.propertyId,
            ...(tokenPayload.queryIds.branchId ? { propertiesBranches: tokenPayload.branchId } : null),
          },
        },
        {
          $project: {
            firstName: 1,
            lastName: 1,
            birthDate: 1,
            profilePhoto: 1,
          },
        },
      ]);

      if (isEmpty(accounts)) {
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
        data: accounts,
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

  public async fetchEmployeeAnniversary(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const currentDate = DateTime.now();
      const staffsEmploymentInformation = await this.staffsEmploymentInformation.aggregate([
        {
          $addFields: {
            dateHired: { $toDate: '$dateHired' },
          },
        },
        {
          $addFields: {
            currentDate: currentDate.toJSDate(), // Get the current date
          },
        },
        {
          $addFields: {
            anniversaryDate: {
              $dateFromParts: {
                year: { $year: '$dateHired' }, // Extract the year from the dateHired field
                month: { $month: '$dateHired' }, // Extract the month from the dateHired field
                day: { $dayOfMonth: '$dateHired' }, // Extract the day from the dateHired field
              },
            },
          },
        },
        {
          $addFields: {
            yearsSinceHired: {
              $subtract: [
                { $year: '$currentDate' }, // Get the current year
                { $year: '$dateHired' }, // Get the year when employee was hired
              ],
            },
          },
        },
        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: [{ $month: '$anniversaryDate' }, currentDate.month],
                },
                {
                  $lte: [{ $dayOfMonth: '$anniversaryDate' }, currentDate.day],
                },
                {
                  $gt: ['$yearsSinceHired', 0],
                },
              ],
            },
          },
        },
        { $lookup: { from: 'accounts', foreignField: '_id', localField: 'staff', as: 'staff' } },
        { $unwind: '$staff' },
      ]);

      if (isEmpty(staffsEmploymentInformation)) {
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
        data: staffsEmploymentInformation,
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

  public async salaryIncrease(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const currentDate = DateTime.now().minus({ months: 1 });

      const staffsEmploymentInformation = await this.staffsEmploymentInformation.aggregate([
        {
          $addFields: {
            dateHired: { $toDate: '$dateHired' },
            salaryIncreaseDate: {
              $toDate: '$salaryIncrease.date',
            },
          },
        },
        {
          $addFields: {
            oneMonthBeforeSalaryIncrease: {
              $dateSubtract: {
                startDate: '$salaryIncreaseDate',
                unit: 'month',
                amount: 1,
              },
            },
          },
        },

        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: [{ $month: '$oneMonthBeforeSalaryIncrease' }, currentDate.month],
                },
                {
                  $lte: [{ $dayOfMonth: '$oneMonthBeforeSalaryIncrease' }, currentDate.day],
                },
              ],
            },

            // oneMonthBeforeSalaryIncrease: {
            //   $eq: currentDate,
            // },
          },
        },

        { $lookup: { from: 'accounts', foreignField: '_id', localField: 'staff', as: 'staff' } },
        { $unwind: '$staff' },
      ]);

      if (isEmpty(staffsEmploymentInformation)) {
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
        data: staffsEmploymentInformation,
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
