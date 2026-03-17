import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CreateStaffDTO,
  CreateStaffSalaryPackageDTO,
  FetchStaffSalaryPackageDTO,
  FetchStaffsDTO,
  RemoveStaffSalaryByDateDTO,
  SetStaffSalaryAdvancementDTO,
  SetStaffSalaryByDateDTO,
  SetStaffSalaryPackageDTO,
  UpdateSalaryIncreaseDTO,
  UpdateStaffEmploymentInformationDTO,
  UpdateStaffEmploymentSettingsDTO,
  UpdateStaffPersonalInformationDTO,
  UpdateStaffSalaryPackageDTO,
} from './dto';
import {
  IResponseHandlerParams,
  ResponseHandlerService,
  Accounts,
  AccountsProperties,
  STATUS_CODE,
  Notifications,
  Cashflow,
  IAuthTokenPayload,
  ACCOUNT_ID,
  NOTIFICATION_DEFAULT_VALUE,
  StaffsEmploymentInformation,
  SYSTEM_ID,
  StaffsSalaryPayment,
  StaffsSalaryPackage,
  Leaves,
  SchedulesShifts,
  ComposedRRule,
  TOTAL_WORKING_HOURS,
  StaffsSalaryAdvancement,
} from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';

@Injectable()
export class StaffsService {
  constructor(
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,
    @InjectModel(StaffsEmploymentInformation) private readonly staffsEmploymentInformation: ReturnModelType<typeof StaffsEmploymentInformation>,
    @InjectModel(StaffsSalaryPayment) private readonly staffsSalaryPayment: ReturnModelType<typeof StaffsSalaryPayment>,
    @InjectModel(StaffsSalaryPackage) private readonly staffsSalaryPackage: ReturnModelType<typeof StaffsSalaryPackage>,
    @InjectModel(Leaves) private readonly leaves: ReturnModelType<typeof Leaves>,
    @InjectModel(SchedulesShifts) private readonly schedulesShifts: ReturnModelType<typeof SchedulesShifts>,
    @InjectModel(StaffsSalaryAdvancement) private readonly staffsSalaryAdvancement: ReturnModelType<typeof StaffsSalaryAdvancement>,
    @InjectModel(Notifications) private readonly notifications: ReturnModelType<typeof Notifications>,
    @InjectModel(Cashflow) private readonly cashflow: ReturnModelType<typeof Cashflow>,
    @InjectModel(AccountsProperties) private readonly accountsProperties: ReturnModelType<typeof AccountsProperties>,
  ) {}

  public async create(body: CreateStaffDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
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
      const role = body.role;

      let birthDate = null;
      if (!isEmpty(body.birthDate)) {
        birthDate = DateTime.fromISO(new Date(body.birthDate).toISOString()).toISODate();
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
        properties: tokenPayload.propertyId,
        propertiesBranches: [tokenPayload.branchId],
        sourceBranch: tokenPayload.branchId,
        language: body?.language ? body.language : 'en',
        notification: NOTIFICATION_DEFAULT_VALUE(role),
        role: role,
        createdFrom: body.createdFrom,
      });

      /* Save associated property */
      await this.accountsProperties.create({
        accounts: createdAccount._id,
        properties: tokenPayload.propertyId,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Staff information was created',
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

  public async fetch(query: FetchStaffsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const defaultLimit = 200;

      const staffs = await this.accounts
        .find({
          properties: tokenPayload.propertyId,
          active: true,
          role: { $ne: 'student' },
          ...(query.includeMe ? null : { _id: { $ne: tokenPayload.accountId } }),
          ...(query.name ? { $or: [{ firstName: { $regex: query.name, $options: 'i' } }, { lastName: { $regex: query.name, $options: 'i' } }] } : null),
        })
        .sort({ createdAt: -1 })
        .limit((query?.limit || defaultLimit) * 1);

      if (isEmpty(staffs)) {
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
        data: staffs,
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
      const staff = await this.accounts.findOne({ _id: id, properties: tokenPayload.propertyId });
      if (isEmpty(staff)) {
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
        data: staff,
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

  // public async setSalary(body: UpdateStaffEmploymentSettingsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   try {
  //     const salary = await this.staffsSalary.find({
  //       staff: body.staffId,
  //       properties: tokenPayload.propertyId,
  //       propertiesBranches: tokenPayload.branchId,
  //       delete: false,
  //     });

  //     if (isEmpty(salary)) {
  //       await this.staffsSalary.create({
  //         staff: body.staffId,
  //         position: body.position,
  //         typeOfLabor: body.typeOfLabor,
  //         workSchedule: body.workSchedule,
  //         basicSalary: body.basicSalary,
  //         dailySalary: body.dailySalary,
  //         consultingCommission: body.consultingCommission,
  //         hourlyTeachingRate: body.hourlyTeachingRate,
  //         hourlyTutoringRate: body.hourlyTutoringRate,
  //         hourlyTAPARate: body.hourlyTAPARate,
  //         insuranceAmount: body.insuranceAmount,
  //         employeePay: body.employeePay,
  //         companyPay: body.companyPay,
  //         addedBy: tokenPayload.accountId,
  //         properties: tokenPayload.propertyId,
  //         propertiesBranches: tokenPayload.branchId,
  //       });
  //     } else {
  //       await this.staffsSalary.findOneAndUpdate(
  //         {
  //           staff: body.staffId,
  //           properties: tokenPayload.propertyId,
  //           propertiesBranches: tokenPayload.branchId,
  //           delete: false,
  //         },
  //         {
  //           $set: {
  //             position: body.position,
  //             typeOfLabor: body.typeOfLabor,
  //             workSchedule: body.workSchedule,
  //             basicSalary: body.basicSalary,
  //             dailySalary: body.dailySalary,
  //             consultingCommission: body.consultingCommission,
  //             hourlyTeachingRate: body.hourlyTeachingRate,
  //             hourlyTutoringRate: body.hourlyTutoringRate,
  //             hourlyTAPARate: body.hourlyTAPARate,
  //             insuranceAmount: body.insuranceAmount,
  //             employeePay: body.employeePay,
  //             companyPay: body.companyPay,
  //           },
  //         },
  //       );
  //     }

  //     return ResponseHandlerService({
  //       success: true,
  //       httpCode: HttpStatus.CREATED,
  //       statusCode: STATUS_CODE.DATA_CREATED,
  //       message: 'Staff salary has been set',
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

  public async updatePersonalInformation(id: string, body: UpdateStaffPersonalInformationDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
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
          ...(account.emailAddresses.length === 0 ? { emailAddresses: body.emailAddresses.map((v) => v.toLocaleLowerCase()) } : null),
          contactNumbers: body.contactNumbers,
          gender: body.gender,
          propertiesBranches: body?.branches || [],
          birthDate: birthDate,
          address: body.address,
          tags: body.tags,
          sources: body.sources,
          active: body.active,
          role: body.role,
        },
        { new: true },
      );

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

  public async updateEmploymentSettings(id: string, body: UpdateStaffEmploymentSettingsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      let staffsEmploymentInformation = await this.staffsEmploymentInformation.findOne({
        staff: body.staffId,
        properties: tokenPayload.propertyId,
        deleted: false,
      });

      if (isEmpty(staffsEmploymentInformation)) {
        staffsEmploymentInformation = await this.staffsEmploymentInformation.create({
          staff: body.staffId,
          position: body.position,
          typeOfLabor: body.typeOfLabor,
          workSchedule: body.workSchedule,
          basicSalary: body.basicSalary,
          dailySalary: body.dailySalary,
          consultingCommission: body.consultingCommission,
          hourlyTeachingRate: body.hourlyTeachingRate,
          hourlyTutoringRate: body.hourlyTutoringRate,
          hourlyTAPARate: body.hourlyTAPARate,
          insuranceAmount: body.insuranceAmount,
          employeePay: body.employeePay,
          companyPay: body.companyPay,
          addedBy: tokenPayload.accountId,
          changeLogs: [
            {
              id: SYSTEM_ID(),
              performedBy: tokenPayload.accountId,
              action: 'insert',
              createdAt: DateTime.now().toISO(),
            },
          ],
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        });
      } else {
        staffsEmploymentInformation = await this.staffsEmploymentInformation.findOneAndUpdate(
          { staff: body.staffId, properties: tokenPayload.propertyId, deleted: false },
          {
            $set: {
              position: body.position,
              typeOfLabor: body.typeOfLabor,
              workSchedule: body.workSchedule,
              basicSalary: body.basicSalary,
              dailySalary: body.dailySalary,
              consultingCommission: body.consultingCommission,
              hourlyTeachingRate: body.hourlyTeachingRate,
              hourlyTutoringRate: body.hourlyTutoringRate,
              hourlyTAPARate: body.hourlyTAPARate,
              insuranceAmount: body.insuranceAmount,
              employeePay: body.employeePay,
              companyPay: body.companyPay,
            },
            $push: {
              changeLogs: {
                id: SYSTEM_ID(),
                performedBy: tokenPayload.accountId,
                action: 'update',
                createdAt: DateTime.now().toISO(),
              },
            },
          },
          { new: true },
        );
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully updated',
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

  // public async setSalary(body: UpdateStaffEmploymentSettingsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   try {
  //     const salary = await this.staffsSalary.find({
  //       staff: body.staffId,
  //       properties: tokenPayload.propertyId,
  //       propertiesBranches: tokenPayload.branchId,
  //       delete: false,
  //     });

  //     if (isEmpty(salary)) {
  //       await this.staffsSalary.create({
  //         staff: body.staffId,
  //         position: body.position,
  //         typeOfLabor: body.typeOfLabor,
  //         workSchedule: body.workSchedule,
  //         basicSalary: body.basicSalary,
  //         dailySalary: body.dailySalary,
  //         consultingCommission: body.consultingCommission,
  //         hourlyTeachingRate: body.hourlyTeachingRate,
  //         hourlyTutoringRate: body.hourlyTutoringRate,
  //         hourlyTAPARate: body.hourlyTAPARate,
  //         insuranceAmount: body.insuranceAmount,
  //         employeePay: body.employeePay,
  //         companyPay: body.companyPay,
  //         addedBy: tokenPayload.accountId,
  //         properties: tokenPayload.propertyId,
  //         propertiesBranches: tokenPayload.branchId,
  //       });
  //     } else {
  //       await this.staffsSalary.findOneAndUpdate(
  //         {
  //           staff: body.staffId,
  //           properties: tokenPayload.propertyId,
  //           propertiesBranches: tokenPayload.branchId,
  //           delete: false,
  //         },
  //         {
  //           $set: {
  //             position: body.position,
  //             typeOfLabor: body.typeOfLabor,
  //             workSchedule: body.workSchedule,
  //             basicSalary: body.basicSalary,
  //             dailySalary: body.dailySalary,
  //             consultingCommission: body.consultingCommission,
  //             hourlyTeachingRate: body.hourlyTeachingRate,
  //             hourlyTutoringRate: body.hourlyTutoringRate,
  //             hourlyTAPARate: body.hourlyTAPARate,
  //             insuranceAmount: body.insuranceAmount,
  //             employeePay: body.employeePay,
  //             companyPay: body.companyPay,
  //           },
  //         },
  //       );
  //     }

  //     return ResponseHandlerService({
  //       success: true,
  //       httpCode: HttpStatus.CREATED,
  //       statusCode: STATUS_CODE.DATA_CREATED,
  //       message: 'Staff salary has been set',
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

  // public async update(body: UpdateStaffSalaryDTO, tokenData: IAuthorizationTokenData): Promise<IResponseHandlerParams> {
  //   try {
  //     const staffsSalaryInfo = await this.staffsSalary.find({
  //       staff: body.staff,
  //       month: body.month,
  //       year: body.year,
  //       properties: tokenData.propertyId,
  //       propertiesBranches: tokenData.branchId,
  //       delete: false,
  //     });

  //     if (isEmpty(staffsSalaryInfo)) {
  //       const month = DateTime.fromISO(body.startDate).month;
  //       const year = DateTime.fromISO(body.startDate).year;

  //       const staffsSalary = await this.staffsSalary.create({
  //         staff: body.staff,
  //         position: body.position,
  //         typeOfLabor: body.typeOfLabor,
  //         workSchedule: body.workSchedule,
  //         startDate: body.startDate,
  //         endDate: body.endDate,
  //         basicSalary: body.basicSalary,
  //         consultingCommission: body.consultingCommission,
  //         hourlyTeachingRate: body.hourlyTeachingRate,
  //         hourlyTutoringRate: body.hourlyTutoringRate,
  //         hourlyTAPARate: body.hourlyTAPARate,
  //         insuranceSalary: body.insuranceSalary,
  //         employeePay: body.employeePay,
  //         companyPay: body.companyPay,
  //         addedBy: tokenData.accountId,
  //         properties: tokenData.propertyId,
  //         propertiesBranches: tokenData.branchId,
  //         month: month,
  //         year: year,
  //       });

  //       await this.notifications.create({
  //         actionType: 'staff-salary',
  //         name: 'Salary',
  //         message: `Your salary has arrived`,
  //         data: {
  //           staffsSalary: staffsSalary._id,
  //         },
  //         accounts: body.staff,
  //         properties: tokenData.propertyId,
  //         propertiesBranches: tokenData.branchId,
  //       });

  //       return ResponseHandlerService({
  //         success: true,
  //         httpCode: HttpStatus.CREATED,
  //         statusCode: STATUS_CODE.DATA_CREATED,
  //         message: 'Staff salary has been created',
  //         data: staffsSalary,
  //       });
  //     } else {
  //       // const staffsSalary = await this.staffsSalary.findOneAndUpdate(
  //       //   {
  //       //     staff: body.staff,
  //       //     properties: tokenData.propertyId,
  //       //     propertiesBranches: tokenData.branchId,
  //       //     delete: false,
  //       //   },
  //       //   {
  //       //     position: body.position,
  //       //     typeOfLabor: body.typeOfLabor,
  //       //     workSchedule: body.workSchedule,
  //       //     startDate: body.startDate,
  //       //     endDate: body.endDate,
  //       //     basicSalary: body.basicSalary,
  //       //     consultingCommission: body.consultingCommission,
  //       //     hourlyTeachingRate: body.hourlyTeachingRate,
  //       //     hourlyTutoringRate: body.hourlyTutoringRate,
  //       //     hourlyTAPARate: body.hourlyTAPARate,
  //       //     insuranceSalary: body.insuranceSalary,
  //       //     employeePay: body.employeePay,
  //       //     companyPay: body.companyPay,
  //       //   },
  //       // );
  //       // return ResponseHandlerService({
  //       //   success: true,
  //       //   httpCode: HttpStatus.OK,
  //       //   statusCode: STATUS_CODE.DATA_UPDATED,
  //       //   message: 'Staff salary has been updated',
  //       //   data: staffsSalary,
  //       // });
  //       return ResponseHandlerService({
  //         success: false,
  //         httpCode: HttpStatus.CONFLICT,
  //         statusCode: STATUS_CODE.ALREADY_EXISTS,
  //         message: 'Already have a data',
  //       });
  //     }
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

  // public async savePayment(body: SavePaymentSalaryDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   try {
  //     const salary = await this.staffsSalary.find({
  //       staff: body.staff,
  //       properties: tokenPayload.propertyId,
  //       propertiesBranches: tokenPayload.branchId,
  //       delete: false,
  //     });

  //     if (isEmpty(salary)) {
  //       return ResponseHandlerService({
  //         success: false,
  //         httpCode: HttpStatus.NOT_FOUND,
  //         statusCode: STATUS_CODE.NOT_FOUND,
  //         message: 'No result(s) found',
  //       });
  //     }

  //     const staffsSalary = await this.staffsSalary.findOneAndUpdate(
  //       {
  //         staff: body.staff,
  //         properties: tokenPayload.propertyId,
  //         propertiesBranches: tokenPayload.branchId,
  //       },
  //       {
  //         $push: {
  //           records: body.records,
  //         },
  //       },
  //     );

  //     // Save the payment
  //     const cashflow = await this.cashflow.create({
  //       note: 'Staff Salary',
  //       payedBy: tokenPayload.accountId,
  //       receivedBy: body.staff,
  //       salary: body.records,
  //       amount: body.records.totalAmount,
  //       mode: 'cash',
  //       type: 'expense',
  //       properties: tokenPayload.propertyId,
  //       propertiesBranches: tokenPayload.branchId,
  //     });

  //     await this.notifications.create({
  //       actionType: 'staff-salary',
  //       name: 'Staff Salary',
  //       message: null, //`Thank you for your payment. Please click the link to see the receipt. <a href="http://localhost:42001/o/c/receipt/${cashflow.transactionId}">Receipt</a>`,
  //       data: {
  //         cashflowId: cashflow._id,
  //         cashflowTransactionId: cashflow.transactionId,
  //       },
  //       accounts: body.staff,
  //       properties: tokenPayload.propertyId,
  //       propertiesBranches: tokenPayload.branchId,
  //     });

  //     return ResponseHandlerService({
  //       success: true,
  //       httpCode: HttpStatus.CREATED,
  //       statusCode: STATUS_CODE.DATA_CREATED,
  //       message: 'Staff salary has been created',
  //       data: staffsSalary,
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

  public async fetchEmploymentSettings(staffId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const staffsEmploymentInformationSalary = await this.staffsEmploymentInformation.findOne({
        staff: staffId,
        properties: tokenPayload.propertyId,
        deleted: false,
      });

      if (isEmpty(staffsEmploymentInformationSalary)) {
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
        data: staffsEmploymentInformationSalary,
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

  // public async update(body: UpdateStaffSalaryDTO, tokenData: IAuthorizationTokenData): Promise<IResponseHandlerParams> {
  //   try {
  //     const staffsSalaryInfo = await this.staffsSalary.find({
  //       staff: body.staff,
  //       month: body.month,
  //       year: body.year,
  //       properties: tokenData.propertyId,
  //       propertiesBranches: tokenData.branchId,
  //       delete: false,
  //     });

  //     if (isEmpty(staffsSalaryInfo)) {
  //       const month = DateTime.fromISO(body.startDate).month;
  //       const year = DateTime.fromISO(body.startDate).year;

  //       const staffsSalary = await this.staffsSalary.create({
  //         staff: body.staff,
  //         position: body.position,
  //         typeOfLabor: body.typeOfLabor,
  //         workSchedule: body.workSchedule,
  //         startDate: body.startDate,
  //         endDate: body.endDate,
  //         basicSalary: body.basicSalary,
  //         consultingCommission: body.consultingCommission,
  //         hourlyTeachingRate: body.hourlyTeachingRate,
  //         hourlyTutoringRate: body.hourlyTutoringRate,
  //         hourlyTAPARate: body.hourlyTAPARate,
  //         insuranceSalary: body.insuranceSalary,
  //         employeePay: body.employeePay,
  //         companyPay: body.companyPay,
  //         addedBy: tokenData.accountId,
  //         properties: tokenData.propertyId,
  //         propertiesBranches: tokenData.branchId,
  //         month: month,
  //         year: year,
  //       });

  //       await this.notifications.create({
  //         actionType: 'staff-salary',
  //         name: 'Salary',
  //         message: `Your salary has arrived`,
  //         data: {
  //           staffsSalary: staffsSalary._id,
  //         },
  //         accounts: body.staff,
  //         properties: tokenData.propertyId,
  //         propertiesBranches: tokenData.branchId,
  //       });

  //       return ResponseHandlerService({
  //         success: true,
  //         httpCode: HttpStatus.CREATED,
  //         statusCode: STATUS_CODE.DATA_CREATED,
  //         message: 'Staff salary has been created',
  //         data: staffsSalary,
  //       });
  //     } else {
  //       // const staffsSalary = await this.staffsSalary.findOneAndUpdate(
  //       //   {
  //       //     staff: body.staff,
  //       //     properties: tokenData.propertyId,
  //       //     propertiesBranches: tokenData.branchId,
  //       //     delete: false,
  //       //   },
  //       //   {
  //       //     position: body.position,
  //       //     typeOfLabor: body.typeOfLabor,
  //       //     workSchedule: body.workSchedule,
  //       //     startDate: body.startDate,
  //       //     endDate: body.endDate,
  //       //     basicSalary: body.basicSalary,
  //       //     consultingCommission: body.consultingCommission,
  //       //     hourlyTeachingRate: body.hourlyTeachingRate,
  //       //     hourlyTutoringRate: body.hourlyTutoringRate,
  //       //     hourlyTAPARate: body.hourlyTAPARate,
  //       //     insuranceSalary: body.insuranceSalary,
  //       //     employeePay: body.employeePay,
  //       //     companyPay: body.companyPay,
  //       //   },
  //       // );
  //       // return ResponseHandlerService({
  //       //   success: true,
  //       //   httpCode: HttpStatus.OK,
  //       //   statusCode: STATUS_CODE.DATA_UPDATED,
  //       //   message: 'Staff salary has been updated',
  //       //   data: staffsSalary,
  //       // });
  //       return ResponseHandlerService({
  //         success: false,
  //         httpCode: HttpStatus.CONFLICT,
  //         statusCode: STATUS_CODE.ALREADY_EXISTS,
  //         message: 'Already have a data',
  //       });
  //     }
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

  // public async savePayment(body: SavePaymentSalaryDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   try {
  //     const salary = await this.staffsSalary.find({
  //       staff: body.staff,
  //       properties: tokenPayload.propertyId,
  //       propertiesBranches: tokenPayload.branchId,
  //       delete: false,
  //     });

  //     if (isEmpty(salary)) {
  //       return ResponseHandlerService({
  //         success: false,
  //         httpCode: HttpStatus.NOT_FOUND,
  //         statusCode: STATUS_CODE.NOT_FOUND,
  //         message: 'No result(s) found',
  //       });
  //     }

  //     const staffsSalary = await this.staffsSalary.findOneAndUpdate(
  //       {
  //         staff: body.staff,
  //         properties: tokenPayload.propertyId,
  //         propertiesBranches: tokenPayload.branchId,
  //       },
  //       {
  //         $push: {
  //           records: body.records,
  //         },
  //       },
  //     );

  //     // Save the payment
  //     const cashflow = await this.cashflow.create({
  //       note: 'Staff Salary',
  //       payedBy: tokenPayload.accountId,
  //       receivedBy: body.staff,
  //       salary: body.records,
  //       amount: body.records.totalAmount,
  //       mode: 'cash',
  //       type: 'expense',
  //       properties: tokenPayload.propertyId,
  //       propertiesBranches: tokenPayload.branchId,
  //     });

  //     await this.notifications.create({
  //       actionType: 'staff-salary',
  //       name: 'Staff Salary',
  //       message: null, //`Thank you for your payment. Please click the link to see the receipt. <a href="http://localhost:42001/o/c/receipt/${cashflow.transactionId}">Receipt</a>`,
  //       data: {
  //         cashflowId: cashflow._id,
  //         cashflowTransactionId: cashflow.transactionId,
  //       },
  //       accounts: body.staff,
  //       properties: tokenPayload.propertyId,
  //       propertiesBranches: tokenPayload.branchId,
  //     });

  //     return ResponseHandlerService({
  //       success: true,
  //       httpCode: HttpStatus.CREATED,
  //       statusCode: STATUS_CODE.DATA_CREATED,
  //       message: 'Staff salary has been created',
  //       data: staffsSalary,
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

  public async setSalaryByDate(staffId: string, body: SetStaffSalaryByDateDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const staffsEmploymentInformationSalary = await this.staffsEmploymentInformation.findOne({
        staff: staffId,
        properties: tokenPayload.propertyId,
        deleted: false,
      });

      if (isEmpty(staffsEmploymentInformationSalary)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      // If theres a salary advancement then deduct the vault
      let loanedAmount = 0;
      let remainingBalance = 0;
      const salaryAdvancementAmountToPay = body?.salaryAdvancementAmountToPay || 0;
      if (!isEmpty(body.salaryAdvancementId)) {
        const salaryAdvancement = await this.staffsSalaryAdvancement.findOne({
          _id: body.salaryAdvancementId,
          staff: staffId,
          properties: tokenPayload.propertyId,
        });

        const agreementIsMet = salaryAdvancement.paymentSequence + 1 >= salaryAdvancement.agreement.every;
        const staffsSalaryAdvancement = await this.staffsSalaryAdvancement.findOneAndUpdate(
          {
            _id: body.salaryAdvancementId,
            staff: staffId,
            properties: tokenPayload.propertyId,
          },
          {
            $inc: {
              paidAmount: body.salaryAdvancementAmountToPay,
            },
            $set: {
              ...(agreementIsMet ? { paymentSequence: 0 } : null),
            },
            $push: {
              transactions: {
                loanedAmount: salaryAdvancement.loanedAmount,
                paidAmount: salaryAdvancement.paidAmount,
                agreement: salaryAdvancement.agreement,
                amountPay: body.salaryAdvancementAmountToPay, // amount pay for this transaction
                datePerformed: DateTime.now().toISO(),
                performedBy: tokenPayload.accountId,
              },
            },
          },
          { new: true },
        );
        loanedAmount = staffsSalaryAdvancement.loanedAmount; // save loan amount because it can be changed in the future
        remainingBalance = staffsSalaryAdvancement.loanedAmount - staffsSalaryAdvancement.paidAmount; // save loan remaining balance because it can be changed in the future
      } else {
        console.log('go here');
        await this.staffsSalaryAdvancement.findOneAndUpdate({ staff: staffId, properties: tokenPayload.propertyId }, { $inc: { paymentSequence: 1 } });
      }

      /* create a salary payment log */
      const staffsSalaryPackage = await this.staffsSalaryPackage.findOne({
        _id: staffsEmploymentInformationSalary.salaryPackageId,
        staff: staffId,
        properties: tokenPayload.propertyId,
      });
      console.log('staffsSalaryPackage', staffsSalaryPackage);

      // const staffsSalaryPayment = await this.staffsSalaryPayment.findOne({
      //   staff: staffId,
      //   dateIssued: body.dateIssued,
      //   properties: tokenPayload.propertyId,
      //   propertiesBranches: tokenPayload.branchId,
      //   deleted: false,
      // });

      // let updatedStaffsSalaryPayment = staffsSalaryPayment;

      // if (isEmpty(staffsSalaryPayment)) {
      // updatedStaffsSalaryPayment = await this.staffsSalaryPayment.create({
      const staffsSalaryPayment = await this.staffsSalaryPayment.create({
        totalStaffSalary: body.totalStaffSalary,
        dateIssued: body.dateIssued,
        workStartDate: body.workStartDate,
        workEndDate: body.workEndDate,
        basicSalary: staffsSalaryPackage.basicSalary,
        dailyRate: body.dailyRate,
        absences: body.absences,
        consultingCommission: staffsSalaryPackage.consultingCommission,
        consultingCommissionQuantity: body.consultingCommissionQuantity,
        hourlyTeachingRate: staffsSalaryPackage.hourlyTeachingRate,
        hourlyTeachingRateQuantity: body.hourlyTeachingRateQuantity,
        hourlyTutoringRate: staffsSalaryPackage.hourlyTutoringRate,
        hourlyTutoringRateQuantity: body.hourlyTutoringRateQuantity,
        hourlyTAPARate: staffsSalaryPackage.hourlyTAPARate,
        hourlyTAPARateQuantity: body.hourlyTAPARateQuantity,
        addition: body.addition,
        subtraction: body.subtraction,
        insuranceAmount: staffsSalaryPackage.insuranceAmount,
        employeePay: staffsSalaryPackage.employeePay,
        companyPay: staffsSalaryPackage.companyPay,

        /*  */
        salaryAdvancement: body.salaryAdvancementId,
        salaryAdvancementLoanedAmount: loanedAmount,
        salaryAdvancementAmountPay: salaryAdvancementAmountToPay,
        salaryAdvancementBalance: remainingBalance,

        totalOfUnpaidHours: body.totalOfUnpaidHours,
        totalAmountOfUnpaidHours: body.totalAmountOfUnpaidHours,
        performedBy: tokenPayload.accountId,
        staff: staffId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      // const computedInsuranceAmount = (): number => {
      //   const insuranceAmount = staffsSalaryPackage.insuranceAmount;
      //   const companyPay = staffsSalaryPackage.companyPay;
      //   const employeePay = staffsSalaryPackage.employeePay;
      //   return ((companyPay + employeePay) / 100) * insuranceAmount;
      // };

      // const totalAmount = (): number => {
      //   const absences = staffsSalaryPackage.dailySalary * body.absences;
      //   const basicSalary = staffsSalaryPackage.basicSalary - absences;
      //   const consultingCommissionTotal = staffsSalaryPackage.consultingCommission * body.consultingCommissionQuantity;
      //   const hourlyTeachingRateTotal = staffsSalaryPackage.hourlyTeachingRate * body.hourlyTeachingRateQuantity;
      //   const hourlyTutoringRateTotal = staffsSalaryPackage.hourlyTutoringRate * body.hourlyTutoringRateQuantity;
      //   const hourlyTAPARateTotal = staffsSalaryPackage.hourlyTAPARate * body.hourlyTAPARateQuantity;
      //   const total = basicSalary + consultingCommissionTotal + hourlyTeachingRateTotal + hourlyTutoringRateTotal + hourlyTAPARateTotal;
      //   return total - computedInsuranceAmount();
      // };

      // Save the payment
      this.cashflow
        .create({
          notes: `Staff salary of ${body.workStartDate} - ${body.workEndDate}. Date issued ${body.dateIssued}`,
          payedBy: tokenPayload.accountId,
          receivedBy: staffId,
          salary: {
            salaryPayment: staffsSalaryPayment._id,
            urlCode: staffsSalaryPayment.urlCode,
          },
          amount: body.totalStaffSalary,
          mode: 'cash',
          type: 'income',
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        })
        .then();
      // } else {
      //   // await this.staffsSalaryPayment.findOneAndUpdate(
      //   //   {
      //   //     staff: staffId,
      //   //     properties: tokenPayload.propertyId,
      //   //     propertiesBranches: tokenPayload.branchId,
      //   //     delete: false,
      //   //   },
      //   //   {
      //   //     $set: {
      //   //       dateIssued: body.dateIssued,
      //   //       workStartDate: body.workStartDate,
      //   //       workEndDate: body.workEndDate,
      //   //       basicSalary: staffsEmploymentInformationSalary.basicSalary,
      //   //       dailySalary: staffsEmploymentInformationSalary.dailySalary,
      //   //       absences: body.absences,
      //   //       consultingCommission: staffsEmploymentInformationSalary.consultingCommission,
      //   //       consultingCommissionQuantity: body.consultingCommissionQuantity,
      //   //       hourlyTeachingRate: staffsEmploymentInformationSalary.hourlyTeachingRate,
      //   //       hourlyTeachingRateQuantity: body.hourlyTeachingRateQuantity,
      //   //       hourlyTutoringRate: staffsEmploymentInformationSalary.hourlyTutoringRate,
      //   //       hourlyTutoringRateQuantity: body.hourlyTutoringRateQuantity,
      //   //       hourlyTAPARate: staffsEmploymentInformationSalary.hourlyTAPARate,
      //   //       hourlyTAPARateQuantity: body.hourlyTAPARateQuantity,
      //   //       insuranceAmount: staffsEmploymentInformationSalary.insuranceAmount,
      //   //       employeePay: staffsEmploymentInformationSalary.employeePay,
      //   //       companyPay: staffsEmploymentInformationSalary.companyPay,
      //   //     },
      //   //   },
      //   // );
      // }

      this.notifications
        .create({
          actionType: 'staff-payslip',
          title: 'Payslip',
          message: 'Your payslip has arrived',
          data: { urlCode: staffsSalaryPayment.urlCode },
          accounts: staffId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        })
        .then();

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Staff salary has been set',
        // data: updatedStaffsSalaryPayment,
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

  public async removeSalaryByDate(staffId: string, body: RemoveStaffSalaryByDateDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const staffsSalaryPayment = await this.staffsSalaryPayment.findOne({
        _id: body.salaryPaymentId,
        staff: staffId,
        properties: tokenPayload.propertyId,
        deleted: false,
      });

      if (isEmpty(staffsSalaryPayment)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      /* delete staff salary payment */
      this.staffsSalaryPayment
        .deleteOne({
          _id: body.salaryPaymentId,
          staff: staffId,
          properties: tokenPayload.propertyId,
          deleted: false,
        })
        .then();

      // delete the payment
      this.cashflow
        .deleteOne({
          'salary.salaryPayment': body.salaryPaymentId,
          properties: tokenPayload.propertyId,
        })
        .then();

      /* revert salary advancement if there is */
      await this.staffsSalaryAdvancement.findOneAndUpdate(
        {
          _id: staffsSalaryPayment.salaryAdvancement,
          staff: staffId,
          properties: tokenPayload.propertyId,
        },
        {
          $inc: {
            paidAmount: -staffsSalaryPayment.salaryAdvancementAmountPay,
          },
        },
      );

      /* delete notification */
      this.notifications
        .deleteOne({
          'data.urlCode': staffsSalaryPayment.urlCode,
          accounts: staffId,
          properties: tokenPayload.propertyId,
        })
        .then();

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Staff salary has been reverted',
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

  public async fetchSalaryByDate(staffId: string, date: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      // const staffsEmploymentInformation = await this.staffsEmploymentInformation.findOne(
      //   { staff: staffId, properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId, deleted: false },
      //   { changeLogs: 0 },
      // );

      /* last record of staff salary payment */
      const staffSalaryPayment = await this.staffsSalaryPayment.findOne({
        staff: staffId,
        deleted: false,
      });
      console.log('staffSalaryPayment ', staffSalaryPayment);

      // if (isEmpty(staffsEmploymentInformation)) {
      //   return ResponseHandlerService({
      //     success: false,
      //     httpCode: HttpStatus.NOT_FOUND,
      //     statusCode: STATUS_CODE.NOT_FOUND,
      //     message: 'No result(s) found',
      //   });
      // }

      const staffsEmploymentInformation = await this.staffsEmploymentInformation.findOne({
        staff: staffId,
        properties: tokenPayload.propertyId,
      });

      if (isEmpty(staffsEmploymentInformation)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      const staffsSalaryPackage = await this.staffsSalaryPackage.findOne({
        _id: staffsEmploymentInformation.salaryPackageId,
        staff: staffId,
        properties: tokenPayload.propertyId,
      });

      if (isEmpty(staffsSalaryPackage)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      /* All requested leaves */
      const unpaidLeaveDates = [];
      const leaves = await this.leaves.find({ staff: staffId, status: 'approved' });
      leaves.forEach((l) => {
        l.dates.forEach((d) => {
          if (l.payable === 'unpaid') {
            unpaidLeaveDates.push(DateTime.fromISO(d.date).toISODate());
          }
        });
      });

      /* All assigned schedule shift contains */
      const schedulesShifts = await this.schedulesShifts.find({
        'staffs.id': staffId,
        properties: tokenPayload.propertyId,
      });

      /* staff salary startDate */
      const staffSalaryStartDate = staffSalaryPayment?.dateIssued ? DateTime.fromISO(staffSalaryPayment?.dateIssued) : null; //DateTime.now().startOf('month'); // last date of salary payment
      const staffSalaryEndDate = DateTime.fromISO(date); //DateTime.now().endOf('month');

      /* Fetch all staff shifts */
      interface IAccumulated {
        basicSalary?: number;
        dailyRate?: number; // used in staff-work
        hourlyRate: number;
        workDaysWithSalary: Array<any>;
        originalSalary: number;
        totalSalary: number;
        totalWorkDays: number;
        unpaidHours: number;
        amountOfUnpaidHours: number;
        totalPaidHours: number;
        amountOfPaidHours: number;
        quantity?: number; // used in class-work, tutoring-work, tapa-work
      }
      // Staff work
      const staffWorkDays = [];
      let staffWorkAccumulated: IAccumulated = {
        basicSalary: 0,
        dailyRate: 0,
        hourlyRate: 0,
        workDaysWithSalary: [],
        originalSalary: 0,
        totalSalary: 0,
        totalWorkDays: 0,
        unpaidHours: 0,
        amountOfUnpaidHours: 0,
        totalPaidHours: 0,
        amountOfPaidHours: 0,
      };

      // Class Work
      const classWorkDays: Array<{ date: string; hours: number; amount: number }> = [];
      let classWorkAccumulated: IAccumulated = {
        hourlyRate: 0,
        workDaysWithSalary: [],
        originalSalary: 0,
        totalSalary: 0,
        totalWorkDays: 0,
        unpaidHours: 0,
        amountOfUnpaidHours: 0,
        totalPaidHours: 0,
        amountOfPaidHours: 0,
        quantity: 0,
      };

      // Class Work
      const tutoringWorkDays: Array<{ date: string; hours: number; amount: number }> = [];
      let tutoringWorkAccumulated: IAccumulated = {
        hourlyRate: 0,
        workDaysWithSalary: [],
        originalSalary: 0,
        totalSalary: 0,
        totalWorkDays: 0,
        unpaidHours: 0,
        amountOfUnpaidHours: 0,
        totalPaidHours: 0,
        amountOfPaidHours: 0,
        quantity: 0,
      };

      // Class Work
      const tapaWorkDays: Array<{ date: string; hours: number; amount: number }> = [];
      let tapaWorkAccumulated: IAccumulated = {
        hourlyRate: 0,
        workDaysWithSalary: [],
        originalSalary: 0,
        totalSalary: 0,
        totalWorkDays: 0,
        unpaidHours: 0,
        amountOfUnpaidHours: 0,
        totalPaidHours: 0,
        amountOfPaidHours: 0,
        quantity: 0,
      };

      if (schedulesShifts) {
        schedulesShifts.forEach((schedulesShift) => {
          const startDate: DateTime = staffSalaryStartDate ? staffSalaryStartDate : DateTime.fromISO(schedulesShift.startDate);

          /* in case of class work, tutoring work, tapa work kukunin lang pag may notes */
          if (schedulesShift.type === 'class-work' || schedulesShift.type === 'tutoring-work' || schedulesShift.type === 'tapa-work') {
            schedulesShift.notes.forEach((note) => {
              /* filter all the notes associated to this staffId  */
              if (note.accountId === staffId) {
                const noteDate = DateTime.fromISO(note.date);

                // note day compare to start date of schedule shift
                if (noteDate.diff(startDate, 'day').days > 0) {
                  /* Class Work - Date Compilation */
                  if (schedulesShift.type === 'class-work') {
                    /** @alreadyExist is incase of double adding note */
                    const alreadyExist = classWorkDays.find((d) => {
                      const diam = DateTime.fromISO(d.date);
                      return diam.day === noteDate.day && diam.month === noteDate.month && diam.year === noteDate.year;
                    });
                    if (!alreadyExist) {
                      // Combine date with times to create DateTime objects
                      const fromDateTime = DateTime.fromISO(`${startDate.toISODate()}T${schedulesShift.time.from}:00`);
                      const toDateTime = DateTime.fromISO(`${startDate.toISODate()}T${schedulesShift.time.to}:00`);
                      // Calculate the duration between the two DateTime objects
                      const duration = toDateTime.diff(fromDateTime, ['hours']);
                      const totalHours = duration.as('hours');
                      classWorkDays.push({
                        date: noteDate.toISODate(),
                        hours: totalHours,
                        amount: staffsSalaryPackage.hourlyTeachingRate * totalHours,
                      });
                    }
                  }

                  /* Tutoring Work - Date Compilation */
                  if (schedulesShift.type === 'tutoring-work') {
                    /** @alreadyExist is incase of double adding note */
                    const alreadyExist = tutoringWorkDays.find((d) => {
                      const diam = DateTime.fromISO(d.date);
                      return diam.day === noteDate.day && diam.month === noteDate.month && diam.year === noteDate.year;
                    });
                    if (!alreadyExist) {
                      // Combine date with times to create DateTime objects
                      const fromDateTime = DateTime.fromISO(`${startDate.toISODate()}T${schedulesShift.time.from}:00`);
                      const toDateTime = DateTime.fromISO(`${startDate.toISODate()}T${schedulesShift.time.to}:00`);
                      // Calculate the duration between the two DateTime objects
                      const duration = toDateTime.diff(fromDateTime, ['hours']);
                      const totalHours = duration.as('hours');
                      tutoringWorkDays.push({
                        date: noteDate.toISODate(),
                        hours: totalHours,
                        amount: staffsSalaryPackage.hourlyTutoringRate * totalHours,
                      });
                    }
                  }

                  /* TAPA Work - Date Compilation */
                  if (schedulesShift.type === 'tapa-work') {
                    /** @alreadyExist is incase of double adding note */
                    const alreadyExist = tapaWorkDays.find((d) => {
                      const diam = DateTime.fromISO(d.date);
                      return diam.day === noteDate.day && diam.month === noteDate.month && diam.year === noteDate.year;
                    });
                    if (!alreadyExist) {
                      // Combine date with times to create DateTime objects
                      const fromDateTime = DateTime.fromISO(`${startDate.toISODate()}T${schedulesShift.time.from}:00`);
                      const toDateTime = DateTime.fromISO(`${startDate.toISODate()}T${schedulesShift.time.to}:00`);
                      // Calculate the duration between the two DateTime objects
                      const duration = toDateTime.diff(fromDateTime, ['hours']);
                      const totalHours = duration.as('hours');
                      tapaWorkDays.push({
                        date: noteDate.toISODate(),
                        hours: totalHours,
                        amount: staffsSalaryPackage.hourlyTAPARate * totalHours,
                      });
                    }
                  }
                }

                // if (requestedDate.month === noteDate.month && requestedDate.year === noteDate.year) {
                //   /* Staff Work */
                //   const staffWorkIsAlreadyExist = staffWorkDaysInAMonth.find((d) => {
                //     const diam = DateTime.fromISO(d);
                //     return diam.day === noteDate.day && diam.month === noteDate.month && diam.year === noteDate.year;
                //   });
                //   if (!staffWorkIsAlreadyExist) {
                //     staffWorkDaysInAMonth.push(note.date);
                //     if (schedulesShift.type === 'tutoring-work' && !unpaidLeaveDates.includes(noteDate.toISODate())) {
                //       // if (c.type === 'tutoring-work') {
                //       totalOfTutoringHours.push(note.date);
                //     }
                //   }

                //   /* TA/PA Work */
                //   const tapaIsAlreadyExist = tapaWorkDaysInAMonth.find((d) => {
                //     const diam = DateTime.fromISO(d);
                //     return diam.day === noteDate.day && diam.month === noteDate.month && diam.year === noteDate.year;
                //   });
                //   console.log('tapaIsAlreadyExist', tapaIsAlreadyExist, schedulesShift.type, note.notes, note.date);
                //   if (!tapaIsAlreadyExist) {
                //     if (schedulesShift.type === 'tapa-work' && !unpaidLeaveDates.includes(noteDate.toISODate())) {
                //       // if (c.type === 'tapa-work') {
                //       tapaWorkDaysInAMonth.push(note.date);
                //       totalOfTAPAHours.push(note.date);
                //     }
                //   }
                // }
              }
            });
          }

          /* in case of staff work, kukunin lang yong business days */
          if (schedulesShift.type === 'staff-work') {
            const staffWorkComposedDates = ComposedRRule({
              ...schedulesShift.schedule,
              fromDate: startDate.toJSDate(),
              fromTime: startDate.toJSDate(),
              fromTimezone: 'UTC',
              allDay: true,
              toDate: staffSalaryEndDate.toJSDate(),
              toTime: staffSalaryEndDate.toJSDate(), // DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.toTime as any).toJSDate()
              toTimezone: 'UTC',
            });
            // console.log('schedulesShift ', schedulesShift.title, staffWorkComposedDates.approximate.all().length, JSON.stringify(staffWorkComposedDates.approximate.all(), null, 2));

            staffWorkComposedDates.approximate.all().forEach((d) => staffWorkDays.push(d));
          }
        });
      }

      /* Staff Work Calculation (work based on schedule) */
      if (staffWorkDays.length > 0) {
        const dailyRate = staffsSalaryPackage.basicSalary / staffWorkDays.length;
        const hourlyRate = dailyRate / TOTAL_WORKING_HOURS;
        const workDaysWithSalary = staffWorkDays.map((da) => {
          return {
            date: da,
            amount: dailyRate,
          };
        });

        /* deduct based on the leaves */
        const totalPaidHours = staffWorkDays.length * 8;
        let unpaidHours = 0;
        let amountOfUnpaidHours = 0;
        leaves.forEach((leave) => {
          leave.dates.forEach((ld) => {
            const leaveDate = DateTime.fromISO(ld.date);
            const onLeaveIndex = staffWorkDays.findIndex((d) => {
              const diam = DateTime.fromJSDate(d);
              return diam.day === leaveDate.day && diam.month === leaveDate.month && diam.year === leaveDate.year;
            });
            if (onLeaveIndex !== -1) {
              const deductAmount = leave.hours * hourlyRate;
              if (leave.payable === 'unpaid') {
                unpaidHours += leave.hours;
                amountOfUnpaidHours += deductAmount;
                // workDaysWithSalary[onLeaveIndex].amount = Math.abs(workDaysWithSalary.at(onLeaveIndex).amount - deductAmount);
              }
            }
          });
        });

        const totalSalary = workDaysWithSalary.reduce((pv, cv) => pv + cv.amount, 0);
        const deductedSalary = totalSalary - amountOfUnpaidHours;

        staffWorkAccumulated = {
          workDaysWithSalary: workDaysWithSalary,
          basicSalary: staffsSalaryPackage.basicSalary,
          dailyRate: dailyRate,
          hourlyRate: hourlyRate,
          originalSalary: totalSalary,
          totalSalary: deductedSalary,
          totalWorkDays: workDaysWithSalary.length,
          unpaidHours: unpaidHours,
          amountOfUnpaidHours: amountOfUnpaidHours,
          totalPaidHours: totalPaidHours - unpaidHours,
          amountOfPaidHours: deductedSalary,
        };
        console.log('staffWorkAccumulated', staffWorkAccumulated);
      }

      /* Class Work Calculation (work based on notes) */
      if (classWorkDays.length > 0) {
        const workDaysWithSalary = classWorkDays;
        /* deduct based on the leaves */
        const totalPaidHours = classWorkDays.reduce((pv, cv) => pv + cv.hours, 0);
        let unpaidHours = 0;
        leaves.forEach((leave) => {
          leave.dates.forEach((ld) => {
            const leaveDate = DateTime.fromISO(ld.date);
            const onLeaveIndex = classWorkDays.findIndex((d) => {
              const diam = DateTime.fromISO(d.date);
              return diam.day === leaveDate.day && diam.month === leaveDate.month && diam.year === leaveDate.year;
            });
            if (onLeaveIndex !== -1) {
              if (leave.payable === 'unpaid') {
                unpaidHours += leave.hours;
              }
            }
          });
        });

        /* calculate the hourlyTeachingRate * unpaidHours = total of unpaid hours */
        const amountOfUnpaidHours = staffsSalaryPackage.hourlyTeachingRate * unpaidHours;

        const totalSalary = workDaysWithSalary.reduce((pv, cv) => pv + cv.amount, 0);
        const deductedSalary = totalSalary - amountOfUnpaidHours;

        classWorkAccumulated = {
          hourlyRate: staffsSalaryPackage.hourlyTeachingRate,
          workDaysWithSalary: workDaysWithSalary,
          originalSalary: totalSalary,
          totalSalary: deductedSalary,
          totalWorkDays: workDaysWithSalary.length,
          unpaidHours: unpaidHours,
          amountOfUnpaidHours: amountOfUnpaidHours,
          totalPaidHours: totalPaidHours,
          amountOfPaidHours: deductedSalary,
          quantity: workDaysWithSalary.length,
        };
        console.log('classWorkAccumulated', classWorkAccumulated);
      }

      /* Tutoring WorkCalculation (work based on notes) */
      if (tutoringWorkDays.length > 0) {
        const workDaysWithSalary = tutoringWorkDays;
        /* deduct based on the leaves */
        const totalPaidHours = tutoringWorkDays.reduce((pv, cv) => pv + cv.hours, 0);
        let unpaidHours = 0;
        leaves.forEach((leave) => {
          leave.dates.forEach((ld) => {
            const leaveDate = DateTime.fromISO(ld.date);
            const onLeaveIndex = tutoringWorkDays.findIndex((d) => {
              const diam = DateTime.fromISO(d.date);
              return diam.day === leaveDate.day && diam.month === leaveDate.month && diam.year === leaveDate.year;
            });
            if (onLeaveIndex !== -1) {
              if (leave.payable === 'unpaid') {
                unpaidHours += leave.hours;
              }
            }
          });
        });

        /* calculate the hourlyTeachingRate * unpaidHours = total of unpaid hours */
        const amountOfUnpaidHours = staffsSalaryPackage.hourlyTutoringRate * unpaidHours;

        const totalSalary = workDaysWithSalary.reduce((pv, cv) => pv + cv.amount, 0);
        const deductedSalary = totalSalary - amountOfUnpaidHours;

        tutoringWorkAccumulated = {
          hourlyRate: staffsSalaryPackage.hourlyTutoringRate,
          workDaysWithSalary: workDaysWithSalary,
          originalSalary: totalSalary,
          totalSalary: deductedSalary,
          totalWorkDays: workDaysWithSalary.length,
          unpaidHours: unpaidHours,
          amountOfUnpaidHours: amountOfUnpaidHours,
          totalPaidHours: totalPaidHours,
          amountOfPaidHours: deductedSalary,
          quantity: workDaysWithSalary.length,
        };
        console.log('tutoringWorkAccumulated', tutoringWorkAccumulated);
      }

      /* TAPA Work Calculation (work based on notes) */
      if (tapaWorkDays.length > 0) {
        const workDaysWithSalary = tapaWorkDays;
        /* deduct based on the leaves */
        const totalPaidHours = tapaWorkDays.reduce((pv, cv) => pv + cv.hours, 0);
        let unpaidHours = 0;
        leaves.forEach((leave) => {
          leave.dates.forEach((ld) => {
            const leaveDate = DateTime.fromISO(ld.date);
            const onLeaveIndex = tapaWorkDays.findIndex((d) => {
              const diam = DateTime.fromISO(d.date);
              return diam.day === leaveDate.day && diam.month === leaveDate.month && diam.year === leaveDate.year;
            });
            if (onLeaveIndex !== -1) {
              if (leave.payable === 'unpaid') {
                unpaidHours += leave.hours;
              }
            }
          });
        });

        /* calculate the hourlyTeachingRate * unpaidHours = total of unpaid hours */
        const amountOfUnpaidHours = staffsSalaryPackage.hourlyTAPARate * unpaidHours;

        const totalSalary = workDaysWithSalary.reduce((pv, cv) => pv + cv.amount, 0);
        const deductedSalary = totalSalary - amountOfUnpaidHours;

        tapaWorkAccumulated = {
          hourlyRate: staffsSalaryPackage.hourlyTAPARate,
          workDaysWithSalary: workDaysWithSalary,
          originalSalary: totalSalary,
          totalSalary: deductedSalary,
          totalWorkDays: workDaysWithSalary.length,
          unpaidHours: unpaidHours,
          amountOfUnpaidHours: amountOfUnpaidHours,
          totalPaidHours: totalPaidHours,
          amountOfPaidHours: deductedSalary,
          quantity: workDaysWithSalary.length,
        };
        console.log('tapaWorkAccumulated', tapaWorkAccumulated);
      }

      // the the associated class of staff
      // get the total notes by date in
      //
      // last date of salary =
      // get the days of a month based on the class scheduled
      // get the daily rate per day
      // deduct the total hours of leave in total in total salary

      // in a month.
      // console.log('tapaWorkDaysInAMonth', tapaWorkDaysInAMonth);
      // console.log('staffWorkDaysInAMonth', staffWorkDaysInAMonth);

      // const staffWorkDailyRate = staffsSalaryPackage.basicSalary / staffWorkDaysInAMonth.length;
      // const staffWorHourlyRate = staffWorkDailyRate / TOTAL_WORKING_HOURS;
      // const staffWorkDaysInAMonthWithSalary = staffWorkDaysInAMonth.map((da) => {
      //   return {
      //     date: da,
      //     amount: staffWorkDailyRate,
      //   };
      // });

      // const tapaDaysInAMonthWithSalary = daysInAMonth.map((da) => {
      //   return {
      //     date: da,
      //     amount: dailyRate,
      //   };
      // });

      // let totalOfUnpaidHours = 0;
      // let totalAmountOfUnpaidHours = 0;
      // leaves.forEach((leave) => {
      //   if (leave.status === 'approved') {
      //     //
      //     leave.dates.forEach((ld) => {
      //       const leaveDate = DateTime.fromISO(ld.date);
      //       const onLeaveIndex = staffWorkDaysInAMonth.findIndex((d) => {
      //         const diam = DateTime.fromISO(d);
      //         return diam.day === leaveDate.day && diam.month === leaveDate.month && diam.year === leaveDate.year;
      //       });
      //       if (onLeaveIndex !== -1) {
      //         const deductHours = leave.hours * staffWorHourlyRate;
      //         if (leave.payable === 'unpaid') {
      //           console.log(' here leave ', leave.notes, deductHours);
      //           totalOfUnpaidHours += leave.hours;
      //           totalAmountOfUnpaidHours += deductHours;
      //           staffWorkDaysInAMonthWithSalary[onLeaveIndex].amount = Math.abs(staffWorkDaysInAMonthWithSalary.at(onLeaveIndex).amount - deductHours);
      //         }
      //       }
      //     });
      //   }
      // });

      // console.log('>> ', staffWorkDaysInAMonthWithSalary);

      // const staffWorkTotalStaffSalary = staffWorkDaysInAMonthWithSalary.reduce((pv, cv) => pv + cv.amount, 0) || 0;
      // const staffWorkTotalStaffWorkDays = staffWorkDaysInAMonthWithSalary.filter((v) => v.amount > 0).length || 0;

      /* check if staff is already paid for the period based on the last salary payment */
      const alreadyReceivedSalary = staffSalaryStartDate ? staffSalaryStartDate.diff(DateTime.fromISO(date), 'day').days >= 0 : false;

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: {
          alreadyReceivedSalary: alreadyReceivedSalary,
          staffSalaryStartDate: staffSalaryStartDate,
          staffSalaryEndDate: staffSalaryEndDate,
          employmentInformation: staffsEmploymentInformation,
          salaryPackage: staffsSalaryPackage,
          schedulesShifts: schedulesShifts,
          staffSalaryPayment: staffSalaryPayment,
          // staffWorkTotalStaffSalary: staffWorkTotalStaffSalary,
          // staffWorkDailyRate: staffWorkDailyRate,
          // staffWorkDaysInAMonthWithSalary: staffWorkDaysInAMonthWithSalary,
          // staffWorkTotalStaffWorkDays: staffWorkTotalStaffWorkDays,
          // totalOfTutoringHours: totalOfTutoringHours,
          // tapaWorkDaysInAMonth: tapaWorkDaysInAMonth,
          // totalOfUnpaidHours,
          // totalAmountOfUnpaidHours,
          staffWorkAccumulated,
          classWorkAccumulated,
          tutoringWorkAccumulated,
          tapaWorkAccumulated,

          /* over all accumulated */
          // totalStaffSalary: staffWorkAccumulated.totalSalary + classWorkAccumulated.totalSalary + tutoringWorkAccumulated.totalSalary + tapaWorkAccumulated.totalSalary,
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

  public async fetchSalaryHistoryById(staffId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const staffsSalaryPayment = await this.staffsSalaryPayment.find({
        staff: staffId,
        properties: tokenPayload.propertyId,
        deleted: false,
      });

      if (isEmpty(staffsSalaryPayment)) {
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
        data: staffsSalaryPayment,
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

  public async createSalaryPackage(staffId: string, body: CreateStaffSalaryPackageDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      console.log('createSalaryPackage ', staffId, body);
      const staffsSalaryPackage = await this.staffsSalaryPackage.create({
        name: body.name,
        jobTitle: body.jobTitle,
        typeOfLabor: body.typeOfLabor,
        basicSalary: body.basicSalary,
        dailySalary: body.dailySalary,
        consultingCommission: body.consultingCommission,
        hourlyTeachingRate: body.hourlyTeachingRate,
        hourlyTutoringRate: body.hourlyTutoringRate,
        hourlyTAPARate: body.hourlyTAPARate,
        insuranceAmount: body.insuranceAmount,
        employeePay: body.employeePay,
        companyPay: body.companyPay,
        addedBy: tokenPayload.accountId,
        staff: staffId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      // this.notifications
      //   .create({
      //     actionType: 'staff-payslip',
      //     title: 'Payslip',
      //     message: 'Your payslip has arrived',
      //     data: { urlCode: updatedStaffsSalaryPayment.urlCode },
      //     accounts: staffId,
      //     properties: tokenPayload.propertyId,
      //     propertiesBranches: tokenPayload.branchId,
      //   })
      //   .then();

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Salary package was created',
        data: staffsSalaryPackage,
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

  public async updateSalaryPackage(staffId: string, salaryPackageId: string, body: UpdateStaffSalaryPackageDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      console.log('updateSalaryPackage ', salaryPackageId, body);
      const staffsSalaryPackage = await this.staffsSalaryPackage.findOneAndUpdate(
        {
          _id: salaryPackageId,
          staff: staffId,
          properties: tokenPayload.propertyId,
          deleted: false,
        },
        {
          name: body.name,
          jobTitle: body.jobTitle,
          typeOfLabor: body.typeOfLabor,
          basicSalary: body.basicSalary,
          dailySalary: body.dailySalary,
          consultingCommission: body.consultingCommission,
          hourlyTeachingRate: body.hourlyTeachingRate,
          hourlyTutoringRate: body.hourlyTutoringRate,
          hourlyTAPARate: body.hourlyTAPARate,
          insuranceAmount: body.insuranceAmount,
          employeePay: body.employeePay,
          companyPay: body.companyPay,
          addedBy: tokenPayload.accountId,
          staff: staffId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        { new: true },
      );

      // this.notifications
      //   .create({
      //     actionType: 'staff-payslip',
      //     title: 'Payslip',
      //     message: 'Your payslip has arrived',
      //     data: { urlCode: updatedStaffsSalaryPayment.urlCode },
      //     accounts: staffId,
      //     properties: tokenPayload.propertyId,
      //     propertiesBranches: tokenPayload.branchId,
      //   })
      //   .then();

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Salary package was updated',
        data: staffsSalaryPackage,
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

  public async fetchSalaryPackages(staffId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const staffsSalaryPackages = await this.staffsSalaryPackage.find({
        staff: staffId,
        properties: tokenPayload.propertyId,
      });

      if (isEmpty(staffsSalaryPackages)) {
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
        data: staffsSalaryPackages,
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

  public async fetchSalaryPackageById(staffId: string, query: FetchStaffSalaryPackageDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const staffsSalaryPackage = await this.staffsSalaryPackage.findOne({
        _id: query.salaryPackageId,
        staff: staffId,
        properties: tokenPayload.propertyId,
      });

      if (isEmpty(staffsSalaryPackage)) {
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
        data: staffsSalaryPackage,
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

  public async assignSalaryPackage(staffId: string, body: SetStaffSalaryPackageDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const staffsSalaryPackage = await this.staffsEmploymentInformation.findOneAndUpdate(
        {
          staff: staffId,
          properties: tokenPayload.propertyId,
        },
        {
          salaryPackageId: body.salaryPackageId,
        },
        { new: true, upsert: true },
      );

      if (isEmpty(staffsSalaryPackage)) {
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
        data: staffsSalaryPackage,
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

  public async assignedSalaryPackage(staffId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const staffsEmploymentInformation = await this.staffsEmploymentInformation.findOne({
        staff: staffId,
        properties: tokenPayload.propertyId,
      });

      if (isEmpty(staffsEmploymentInformation)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      const staffsSalaryPackage = await this.staffsSalaryPackage.findOne({
        _id: staffsEmploymentInformation.salaryPackageId,
        staff: staffId,
        properties: tokenPayload.propertyId,
      });

      if (isEmpty(staffsSalaryPackage)) {
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
        data: {
          employmentInformation: staffsEmploymentInformation,
          salaryPackage: staffsSalaryPackage,
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

  public async updateEmploymentInformation(staffId: string, body: UpdateStaffEmploymentInformationDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const staffsEmploymentInformation = await this.staffsEmploymentInformation.findOneAndUpdate(
        {
          staff: staffId,
          properties: tokenPayload.propertyId,
        },
        { dateHired: body.dateHired },
        { new: true, upsert: true },
      );

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
        statusCode: STATUS_CODE.DATA_UPDATED,
        data: staffsEmploymentInformation,
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

  public async updateSalaryIncrease(staffId: string, body: UpdateSalaryIncreaseDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const staffsEmploymentInformation = await this.staffsEmploymentInformation.findOne({
        staff: staffId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      const updatedStaffsEmploymentInformation = await this.staffsEmploymentInformation.findOneAndUpdate(
        {
          staff: staffId,
          properties: tokenPayload.propertyId,
        },
        {
          'salaryIncrease.date': DateTime.fromISO(staffsEmploymentInformation.dateHired)
            .plus({
              [body.type]: body.count - 1, // minus 1 because counting will start from on dateHired
            })
            .toISO(),
          'salaryIncrease.count': body.count,
          'salaryIncrease.type': body.type,
        },
        { new: true, upsert: true },
      );

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
        statusCode: STATUS_CODE.DATA_UPDATED,
        data: updatedStaffsEmploymentInformation,
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

  public async fetchSalaryAdvancement(staffId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const staffsSalaryAdvancement = await this.staffsSalaryAdvancement.findOne({
        staff: staffId,
        properties: tokenPayload.propertyId,
      });

      if (isEmpty(staffsSalaryAdvancement)) {
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
        data: staffsSalaryAdvancement,
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

  public async setSalaryAdvancement(staffId: string, body: SetStaffSalaryAdvancementDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      let staffsSalaryAdvancement = await this.staffsSalaryAdvancement.findOne({
        staff: staffId,
        properties: tokenPayload.propertyId,
      });

      if (isEmpty(staffsSalaryAdvancement)) {
        staffsSalaryAdvancement = await this.staffsSalaryAdvancement.create({
          loanedAmount: body.loanedAmount,
          staff: staffId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        });
      } else {
        staffsSalaryAdvancement = await this.staffsSalaryAdvancement.findOneAndUpdate(
          {
            staff: staffId,
            properties: tokenPayload.propertyId,
          },
          {
            loanedAmount: body.loanedAmount,
            agreement: body.agreement,
          },
          { new: true },
        );
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: staffsSalaryAdvancement,
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
