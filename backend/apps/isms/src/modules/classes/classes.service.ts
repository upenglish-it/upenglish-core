// NestJs imports
import { InjectModel } from 'nestjs-typegoose';
import { forwardRef, HttpStatus, Inject, Injectable } from '@nestjs/common';
// Commons
import {
  Accounts,
  ActivityLogs,
  Cashflow,
  Classes,
  ClassesDay,
  ClassesTime,
  CompareDates,
  ComposedRRule,
  Courses,
  GetAvailableNextDay,
  GetProceedingDates,
  IAuthTokenPayload,
  IResponseHandlerParams,
  IStudentsTuitionAttendanceRecord,
  Notifications,
  ResponseHandlerService,
  SchedulesShifts,
  STATUS_CODE,
  StudentsTuitionAttendance,
  StudentsSavingsBreakdown,
  // DISCOUNT,
  // BASE_PRICE,
  SYSTEM_ID,
  StudentsTuitionAttendanceDraft,
  PaginationFieldsU,
  PaginationService,
} from 'apps/common';
// Packages
import { RRule } from 'rrule';
import { nanoid } from 'nanoid';
import { DateTime } from 'luxon';
import { differenceInDays } from 'date-fns';
import { ReturnModelType } from '@typegoose/typegoose';
import { first, isEmpty, round, sortBy } from 'lodash';
import { InactiveAccountScheduler } from '../scheduler/inactive-account.scheduler';
// Dtos
import {
  CreateClassDayDTO,
  CreateClassDTO,
  CreateClassTimeDTO,
  FetchClassDTO,
  SetVersionClassTuitionPaymentDTO,
  UpdateClassDayDTO,
  UpdateClassDTO,
  UpdateClassTimeDTO,
  CreateDraftTuitionDTO,
  FetchDraftTuitionDTO,
} from './dto';
import {
  AttendanceStudentsInClassDTO,
  BreakdownOfClassDTO,
  ClassPricingDTO,
  EnrollStudentToClassDTO,
  IClassPricingDate,
  MarkAttendanceDTO,
  RefundClassDTO,
  StopLearningDTO,
  StudentClassDebtsDTO,
  TuitionStudentsInClassDTO,
} from './dto/src/enroll-student.dto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const orderId = require('order-id')(process.env.ORDER_NUMBER_KEY);

@Injectable()
export class ClassesService {
  constructor(
    @Inject(forwardRef(() => InactiveAccountScheduler)) private readonly inactiveAccountScheduler: InactiveAccountScheduler,
    @InjectModel(Notifications) private readonly notifications: ReturnModelType<typeof Notifications>,
    @InjectModel(Cashflow) private readonly cashflow: ReturnModelType<typeof Cashflow>,
    @InjectModel(Classes) private readonly classes: ReturnModelType<typeof Classes>,
    @InjectModel(ClassesDay) private readonly classesDay: ReturnModelType<typeof ClassesDay>,
    @InjectModel(ClassesTime) private readonly classesTime: ReturnModelType<typeof ClassesTime>,
    @InjectModel(StudentsTuitionAttendance) private readonly studentsTuitionAttendance: ReturnModelType<typeof StudentsTuitionAttendance>,
    @InjectModel(StudentsTuitionAttendanceDraft)
    private readonly studentsTuitionAttendanceDraft: ReturnModelType<typeof StudentsTuitionAttendanceDraft>,
    @InjectModel(StudentsSavingsBreakdown) private readonly studentsSavingsBreakdown: ReturnModelType<typeof StudentsSavingsBreakdown>,
    @InjectModel(Courses) private readonly courses: ReturnModelType<typeof Courses>,
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,
    @InjectModel(SchedulesShifts) private readonly schedulesShifts: ReturnModelType<typeof SchedulesShifts>, // private readonly studentsTuitionAttendanceService: StudentsTuitionAttendanceService,
    @InjectModel(ActivityLogs) private readonly activityLogs: ReturnModelType<typeof ActivityLogs> // private readonly studentsTuitionAttendanceService: StudentsTuitionAttendanceService,
  ) {}

  public async create(body: CreateClassDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdClass = await this.classes.create({
        name: body.name,
        courses: body.course,
        typeOfRate: body.typeOfRate,
        // teacher: body.teacherId,
        // classesDay: body.classesDay,
        // classesTime: body.classesTime,
        // startDate: body.startDate,
        // endDate: body.endDate,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Class was created',
        data: createdClass,
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

  public async updateById(classId: string, body: UpdateClassDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdClass = await this.classes.findOneAndUpdate(
        {
          _id: classId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        {
          name: body.name,
          courses: body.course,
          // teacher: body.teacherId,
          // classesDay: body.classesDay,
          // classesTime: body.classesTime,
          // startDate: body.startDate,
          // endDate: body.endDate,
        },
        { new: true }
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Class was updated',
        data: createdClass,
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

  public async fetch(query: FetchClassDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const classQuery: Array<any> = [
        {
          $match: {
            ...(query.name ? { name: { $regex: query.name, $options: 'i' } } : null),
            properties: tokenPayload.propertyId,
            ...(tokenPayload.queryIds.branchId
              ? {
                  propertiesBranches: tokenPayload.branchId,
                }
              : null),
            deleted: false,
          },
        },
        {
          $lookup: {
            from: 'courses',
            localField: 'courses',
            foreignField: '_id',
            as: 'courses',
          },
        },
        {
          $unwind: {
            path: '$courses',
            preserveNullAndEmptyArrays: true,
          },
        },

        /* Pull schedule shifts */
        {
          $lookup: {
            from: 'schedules-shifts',
            // localField: 'classes',
            // foreignField: 'classes',
            let: {
              classId: '$_id',
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ['$classes', '$$classId'],
                  },
                },
              },
              {
                $group: {
                  _id: '$classes',
                  schedule: {
                    $first: '$schedule',
                  },
                  startDate: {
                    $first: '$startDate',
                  },
                  time: {
                    $first: '$time',
                  },
                },
              },
              // {
              //   $project: {
              //     _id: 1,
              //     schedule: 1,
              //     startDate: 1,
              //     time: 1,
              //   },
              // },
            ],
            as: 'schedulesShift',
          },
        },
        {
          $unwind: {
            path: '$schedulesShift',
            preserveNullAndEmptyArrays: true,
          },
        },
      ];

      if (query.showTotalMembers) {
        const totalMembersQuery = [
          {
            $lookup: {
              from: 'students-tuition-attendance',
              let: {
                classId: '$_id',
                student: '$student',
              },
              pipeline: [
                {
                  $match: {
                    // status: 'ongoing',
                    $expr: {
                      $and: [{ $eq: ['$status', 'ongoing'] }, { $eq: ['$classes', '$$classId'] }],
                    },
                  },
                },
                {
                  $project: {
                    records: 0,
                    paymentHistory: 0,
                  },
                },
                {
                  $lookup: {
                    from: 'accounts',
                    localField: 'student',
                    foreignField: '_id',
                    pipeline: [
                      {
                        $project: {
                          firstName: 1,
                          lastName: 1,
                        },
                      },
                    ],
                    as: 'studentInfo',
                  },
                },
                {
                  $unwind: '$studentInfo',
                },
              ],
              as: 'studentsTuitionAttendance',
            },
          },
          {
            $unwind: {
              path: '$studentsTuitionAttendance',
              preserveNullAndEmptyArrays: true,
            },
          },

          {
            $addFields: {
              totalMembers: [
                {
                  $size: '$studentsTuitionAttendance',
                },
              ],
            },
          },
          {
            $addFields: {
              totalMembers: {
                $arrayElemAt: ['$totalMembers', 0],
              },
            },
          },
        ];
        classQuery.push(...totalMembersQuery);
      }

      const classes = await this.classes.aggregate(classQuery).sort({ name: 1 });

      if (isEmpty(classes)) {
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
        data: classes,
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

  public async fetchById(classId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const query = {
        _id: classId,
        properties: tokenPayload.propertyId,
        ...(tokenPayload.queryIds.branchId
          ? {
              propertiesBranches: tokenPayload.branchId,
            }
          : null),
        deleted: false,
      };

      const classes = await this.classes.findOne(query);

      if (isEmpty(classes)) {
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
        data: classes,
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

  public async softDelete(classId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.classes.updateOne(
        {
          _id: classId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        { deleted: true }
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Class has been deleted',
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

  public async createDay(body: CreateClassDayDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdDay = await this.classesDay.create({
        name: body.name,
        days: body.days,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Day was created',
        data: createdDay,
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

  public async updateDayById(dayId: string, body: UpdateClassDayDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdClassDay = await this.classesDay.findOneAndUpdate(
        {
          _id: dayId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        {
          name: body.name,
          days: body.days,
        },
        { new: true }
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Class day was updated',
        data: createdClassDay,
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

  public async fetchDays(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdClasses = await this.classesDay
        .find({
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        })
        .sort({ createdAt: -1 });

      if (isEmpty(createdClasses)) {
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
        data: createdClasses,
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

  public async fetchDayById(dayId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const classesDay = await this.classesDay
        .findOne({
          _id: dayId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        })
        .sort({ createdAt: -1 });

      if (isEmpty(classesDay)) {
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
        data: classesDay,
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

  public async softDeleteDay(dayId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.classesDay.updateOne(
        {
          _id: dayId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        { deleted: true }
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Day has been deleted',
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

  public async createTime(body: CreateClassTimeDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdDay = await this.classesTime.create({
        name: body.name,
        from: body.from,
        to: body.to,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Time was created',
        data: createdDay,
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

  public async fetchTime(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdTime = await this.classesTime
        .find({
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        })
        .sort({ createdAt: -1 });

      if (isEmpty(createdTime)) {
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
        data: createdTime,
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

  public async fetchTimeById(timeId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const classesTime = await this.classesTime
        .findOne({
          _id: timeId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        })
        .sort({ createdAt: -1 });

      if (isEmpty(classesTime)) {
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
        data: classesTime,
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

  public async updateTimeById(timeId: string, body: UpdateClassTimeDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdClassTime = await this.classesTime.findOneAndUpdate(
        {
          _id: timeId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        {
          name: body.name,
          from: body.from,
          to: body.to,
        },
        { new: true }
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Class time was updated',
        data: createdClassTime,
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

  public async softDeleteTime(timeId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.classesTime.updateOne(
        {
          _id: timeId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        { deleted: true }
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Time has been deleted',
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

  public async enrollToClass(body: EnrollStudentToClassDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      /* check first if student is already enrolled */

      if (body.newEnroll) {
        /* add filter to all enrolled class kung meron debt */
        const studentClassInfo = await this.studentsTuitionAttendance
          .findOne({
            classes: body.classId,
            student: body.studentId,
            deleted: false,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
          })
          .sort({ createdAt: -1 });

        if (!isEmpty(studentClassInfo)) {
          /* if the class is completed then proceed to enroll class */
          if (studentClassInfo.status !== 'completed') {
            let message = null;

            if (studentClassInfo.status === 'ongoing') {
              message = 'Student is already enrolled to this class. Please continue to the tuition payment';
            }

            const unpaidDays = studentClassInfo.records.filter((r) => !r.paid && r.enable && r.included);
            if (unpaidDays.length > 0) {
              message = 'Student is not yet paid to this class. Please continue to the tuition payment';
            }

            if (!isEmpty(message)) {
              return ResponseHandlerService({
                success: false,
                httpCode: HttpStatus.UNAUTHORIZED,
                statusCode: STATUS_CODE.REQUEST_DENIED,
                message: message,
              });
            }
          }
        }
      }

      const schedulesShift: SchedulesShifts = await this.schedulesShifts.findOne({
        classes: body.classId,
        deleted: false,
        // properties: tokenPayload.propertyId,
        // propertiesBranches: tokenPayload.branchId,
      });

      if (isEmpty(schedulesShift?.schedule)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.CONFLICT,
          statusCode: STATUS_CODE.UNPROCESSABLE_DATA,
          message: 'Please setup first the schedule for the selected class.',
        });
      }

      const associatedClass = await this.classes.aggregate([
        { $match: { _id: body.classId, deleted: false, properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId } },
        { $lookup: { from: 'courses', foreignField: '_id', localField: 'courses', as: 'courses' } },
        { $unwind: '$courses' },
      ]);
      //await this.classes.findOne({ _id: body.classId });

      if (isEmpty(associatedClass)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'Class does not exist',
        });
      }
      const classes = associatedClass[0];

      /* Check if attendance of the class is already exist */
      const alreadyEnrolled = await this.studentsTuitionAttendance.findOne({
        _id: body.studentClassId,
        student: body.studentId,
        // status: 'ongoing',
        deleted: false,
      });

      const classPricing = await this.classPricing(body, tokenPayload);

      const paymentHistoryId = SYSTEM_ID();
      const paymentHistory = {
        id: paymentHistoryId,
        urlCode: nanoid(),
        transactionId: orderId.generate(),
        performedBy: tokenPayload.accountId,
        data: classPricing.data,
        notes: body.notes,
        createdAt: DateTime.now().toISO(),
      };

      ////////////////
      /* @BASE_PRICE is monthly price */
      /* Monthly Price/No. of Days = Daily Price */
      // const BASE_PRICE = (associatedClass[0] as Classes).courses.price;
      const monthlyPrice = classes.courses.price;
      const hourlyMonthlyPrice = classes.courses.hourlyMonthlyPrice;
      const hourlyPackagePrice = classes.courses.hourlyPackagePrice;

      /* group the days by month to get the price per day based on monthly price */
      // const grouppedDatesByMonth: Array<{ date: string; year: number; month: number; items: Array<{ date: IClassPricingDate }> }> = [];
      // body.dates.forEach((date) => {
      //   const luxonDate = DateTime.fromObject({
      //     day: date.day,
      //     month: date.month,
      //     year: date.year,
      //   });
      //   const grouppedDatesByMonthIndex = grouppedDatesByMonth.findIndex((e) => e.month === date.month && e.year === date.year);
      //   if (grouppedDatesByMonthIndex === -1) {
      //     grouppedDatesByMonth.push({ date: luxonDate.toISO(), year: luxonDate.year, month: luxonDate.month, items: [{ date: date }] });
      //   } else {
      //     grouppedDatesByMonth[grouppedDatesByMonthIndex].items.push({ date: date });
      //   }
      // });

      let scheduleToDate: DateTime = DateTime.fromISO(schedulesShift.schedule.toDate as any);
      if (schedulesShift.schedule.recurrence.value === 'custom') {
        switch (schedulesShift.schedule.recurrence.ends.type) {
          case 'on':
            scheduleToDate = DateTime.fromISO(schedulesShift.schedule.recurrence.ends.endDate);
            break;
          case 'never':
            scheduleToDate = DateTime.now().plus({ years: 1, months: 6 });
            break;
        }
      }

      /* already enrolled student */
      if (!isEmpty(alreadyEnrolled)) {
        const mappedDates = body.dates.map((d) => {
          d['id'] = SYSTEM_ID();
          d['completed'] = false;
          if (body.discount > 0 && d.enable && d.included) {
            const monthRecords = body.dates.filter((bd) => bd.enable && bd.included && bd.month === d.month && bd.year === d.year);
            d.amount = classPricing.data.subTotalAmountWithoutSavings / monthRecords.length;
          } else {
            const totalDaysInMonth = alreadyEnrolled.records.filter((gd) => gd.month === d.month && gd.year === d.year);

            let dailyPrice = 0;
            if (d.paymentType === 'package' || d.paymentType === 'monthly') {
              dailyPrice = monthlyPrice / totalDaysInMonth.length;
            } else if (d.paymentType === 'hourly-monthly' || d.paymentType === 'hourly-package') {
              const from = DateTime.fromFormat(schedulesShift.time.from, 'HH:mm');
              const to = DateTime.fromFormat(schedulesShift.time.to, 'HH:mm');
              let diff = to.diff(from, 'hours').hours;
              if (diff < 0) {
                diff = to.plus({ days: 1 }).diff(from, 'hours').hours;
              }
              let totalPrice = 0;
              if (d.paymentType === 'hourly-monthly') {
                totalPrice = hourlyMonthlyPrice * diff;
              }
              if (d.paymentType === 'hourly-package') {
                totalPrice = hourlyPackagePrice * diff;
              }
              dailyPrice = totalPrice;
            }
            d.amount = dailyPrice;
          }

          d.paymentHistoryId = paymentHistoryId;
          return d;
        });

        // console.log('mappedDates', JSON.stringify(mappedDates, null));

        this.studentsTuitionAttendance
          .findOneAndUpdate(
            {
              _id: body.studentClassId,
              student: body.studentId,
              properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
              deleted: false,
            },
            {
              $push: {
                changeLogs: {
                  $each: [
                    {
                      id: SYSTEM_ID(),
                      actionType: 'pay-tuition',
                      dateCreated: DateTime.now().toISO(),
                      data: alreadyEnrolled,
                    },
                  ],
                  $sort: { dateCreated: -1 },
                },
              },
            }
          )
          .then();

        // update the selected month
        let updatedAlreadyEnrolled = alreadyEnrolled;

        if (body.dates.length) {
          // console.log('update class here');

          const updatedRecords: IStudentsTuitionAttendanceRecord[] = alreadyEnrolled.records.map((record: IStudentsTuitionAttendanceRecord) => {
            const matchedBodyRecord = body.dates.find((d) => d.day === record.day && d.month === record.month && d.year === record.year);

            let newRecord: IStudentsTuitionAttendanceRecord = record;
            if (matchedBodyRecord) {
              /* if its already been paid then don't update the payment */
              if (!record.paid) {
                // console.log('old matchedBodyRecord', matchedBodyRecord, record);
                newRecord = {
                  ...record, // include previous record incase of marked attendance before
                  ...matchedBodyRecord,
                };
                // record.paymentType = matchedBodyRecord.paymentType;
                record.paymentHistoryId = paymentHistoryId;
                // record.paymentHistoryId = paymentHistoryId;
                // console.log('new matchedBodyRecord', matchedBodyRecord);
              }
              // if (newRecord.paid) {
              //   record.paymentType = matchedBodyRecord.paymentType;
              // }
              // console.log('newRecord', newRecord);
            }

            /* if the day is excluded then don't set the value of paymentHistoryId */
            newRecord.paymentHistoryId = !newRecord.enable && newRecord.included ? null : newRecord.paymentHistoryId;
            return newRecord;
          });

          // console.log('updatedRecords ', JSON.stringify(updatedRecords, null, 2));

          updatedAlreadyEnrolled = await this.studentsTuitionAttendance.findOneAndUpdate(
            {
              _id: body.studentClassId,
              student: body.studentId,
              properties: tokenPayload.propertyId,
              deleted: false,
            },
            { $set: { records: updatedRecords } },
            { new: true }
          );
        }

        /* if the user pay the debt, then update the debt days */
        if (classPricing.data.totalAmountOfUnpaidDays > 0 && body.payDebt && classPricing.data.totalAmountOfUnpaidDays > 0) {
          /* update the record and mark paid the debt */
          const updatedRecords = updatedAlreadyEnrolled.records.map((record) => {
            if (record.included && record.enable && !record.paid) {
              record.paid = true;
              record.included = true;
              record.enable = true;
            }
            return record;
          });
          await this.studentsTuitionAttendance.findOneAndUpdate(
            {
              _id: body.studentClassId,
              student: body.studentId,
              properties: tokenPayload.propertyId,
              deleted: false,
            },
            { $set: { records: updatedRecords } }
          );
        }

        /* if the user pay the debt of stopped class then make it completed */
        if (alreadyEnrolled.status === 'stopped' && body.payDebt) {
          this.studentsTuitionAttendance
            .findOneAndUpdate(
              {
                _id: body.studentClassId,
                student: body.studentId,
                properties: tokenPayload.propertyId,
                propertiesBranches: tokenPayload.branchId,
                deleted: false,
              },
              { status: 'completed' }
            )
            .then();

          // return ResponseHandlerService({
          //   success: false,
          //   httpCode: HttpStatus.EXPECTATION_FAILED,
          //   statusCode: STATUS_CODE.REQUEST_DENIED,
          //   message: 'Student class is not ongoing',
          // });
        }

        // push the new/not remaining in month dates
        // mappedDates = mappedDates.filter((md) => !md.remainingInMonth);
        if (mappedDates.length >= 0) {
          if (!body.cantPayThisMonth) {
            await this.studentsTuitionAttendance.findOneAndUpdate(
              {
                _id: body.studentClassId,
                student: body.studentId,
                properties: tokenPayload.propertyId,
                propertiesBranches: tokenPayload.branchId,
                deleted: false,
              },
              {
                $push: {
                  // records: {
                  //   $each: mappedDates,
                  // },
                  paymentHistory: {
                    ...paymentHistory,
                    // 'data.records': mappedDates,
                  },
                },
              }
            );
          }
        }

        if (!body.cantPayThisMonth) {
          // Save the payment
          this.cashflow
            .create({
              notes: 'Tuition payment of student',
              payedBy: body.studentId,
              receivedBy: tokenPayload.accountId,
              tuition: {
                tuitionAttendance: body.studentClassId,
                urlCode: paymentHistory.urlCode,
                dates: [paymentHistory.data.fromDate, paymentHistory.data.toDate],
                className: classes.name,
              },
              amount: paymentHistory.data.deductedTotalAmount,
              mode: 'cash',
              type: 'income',
              properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
            })
            .then();
        }
      } else {
        /* newly enrolled student */
        const mappedDates = body.dates.map((d) => {
          d['id'] = SYSTEM_ID();
          d['completed'] = false;

          const totalDaysInMonth = body.dates.filter((gd) => gd.month === d.month && gd.year === d.year);
          // const dailyPrice = monthlyPrice / totalDaysInMonth.length;

          let dailyPrice = 0;

          if (d.paymentType === 'package' || d.paymentType === 'monthly') {
            dailyPrice = monthlyPrice / totalDaysInMonth.length;
          } else if (d.paymentType === 'hourly-monthly' || d.paymentType === 'hourly-package') {
            const from = DateTime.fromFormat(schedulesShift.time.from, 'HH:mm');
            const to = DateTime.fromFormat(schedulesShift.time.to, 'HH:mm');
            let diff = to.diff(from, 'hours').hours;
            if (diff < 0) {
              diff = to.plus({ days: 1 }).diff(from, 'hours').hours;
            }
            let totalPrice = 0;
            if (d.paymentType === 'hourly-monthly') {
              totalPrice = hourlyMonthlyPrice * diff;
            }
            if (d.paymentType === 'hourly-package') {
              totalPrice = hourlyPackagePrice * diff;
            }
            dailyPrice = totalPrice;
          }

          d.amount = dailyPrice;
          d.paymentHistoryId = d.enable && d.included ? paymentHistoryId : null;
          return d;
        });

        // console.log('mappedDates', JSON.stringify(mappedDates, null));
        const scheduleFromDate = DateTime.fromISO(schedulesShift.startDate as any);
        const scheduleFromDateStartMonth = scheduleFromDate.startOf('month');

        const sinceFromDate = ComposedRRule({
          ...schedulesShift.schedule,
          fromDate: scheduleFromDateStartMonth.toJSDate(), //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromDate as any).toJSDate(),
          fromTime: scheduleFromDateStartMonth.toJSDate(), //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromTime as any).toJSDate(),
          allDay: true,
          toDate: scheduleToDate.toJSDate(),
          toTime: scheduleToDate.toJSDate(), // DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.toTime as any).toJSDate()
        } as any);

        // console.log('sinceFromDate.approximate.all()', sinceFromDate.approximate.all());

        const scheduleGrouppedDatesByMonth: Array<{
          date: string;
          year: number;
          month: number;
          items: Array<{ date: string; enable: boolean; included: boolean }>;
        }> = [];
        sinceFromDate.approximate.all().forEach((date) => {
          const luxonDate = DateTime.fromJSDate(date);
          const isExistIndex = scheduleGrouppedDatesByMonth.findIndex((d) => d.month === luxonDate.month && d.year === luxonDate.year);

          const existInBodyDates = body.dates.find((d) => d.day === luxonDate.day && d.month === luxonDate.month && d.year === luxonDate.year);

          if (isExistIndex === -1) {
            scheduleGrouppedDatesByMonth.push({
              date: luxonDate.toISO(),
              year: luxonDate.year,
              month: luxonDate.month,
              items: [
                {
                  date: luxonDate.toISO(),
                  enable: existInBodyDates ? existInBodyDates.enable : false,
                  included: existInBodyDates ? existInBodyDates.included : false,
                },
              ],
            });
          } else {
            scheduleGrouppedDatesByMonth[isExistIndex].items.push({
              date: luxonDate.toISO(),
              enable: existInBodyDates ? existInBodyDates.enable : false,
              included: existInBodyDates ? existInBodyDates.included : false,
            });
          }
        });

        // console.log('scheduleGrouppedDatesByMonth', scheduleGrouppedDatesByMonth);

        // const DateTime.fromISO(schedulesShift.startDate as any);
        const newMappedDates = sinceFromDate.approximate
          .all()
          .map((d) => {
            const recordDate = DateTime.fromJSDate(d);

            // default value of record
            let record: any = {
              included: false,
              enable: false,
              day: recordDate.day,
              month: recordDate.month,
              year: recordDate.year,
              paid: false,
              paymentType: null,
            };
            record['id'] = SYSTEM_ID();
            d['completed'] = false;

            const enrolledDate = mappedDates.find((md) => md.day === recordDate.day && md.month === recordDate.month && md.year === recordDate.year);
            // update with the enrolled date
            if (enrolledDate) {
              record = enrolledDate;
            }

            if (body.discount > 0 && record.enable && record.included) {
              const monthRecords = mappedDates.filter((md) => md.enable && md.included && md.month === record.month && md.year === record.year);

              if (record.paymentType === 'package' || record.paymentType === 'monthly') {
                record['amount'] = classPricing.data.subTotalAmountWithoutSavings / monthRecords.length;
              } else if (record.paymentType === 'hourly-monthly' || record.paymentType === 'hourly-package') {
                const from = DateTime.fromFormat(schedulesShift.time.from, 'HH:mm');
                const to = DateTime.fromFormat(schedulesShift.time.to, 'HH:mm');
                let diff = to.diff(from, 'hours').hours;
                if (diff < 0) {
                  diff = to.plus({ days: 1 }).diff(from, 'hours').hours;
                }
                let totalPrice = 0;
                if (record.paymentType === 'hourly-monthly') {
                  totalPrice = hourlyMonthlyPrice * diff;
                }
                if (record.paymentType === 'hourly-package') {
                  totalPrice = hourlyPackagePrice * diff;
                }
                record['amount'] = totalPrice;
              }
            } else {
              /* get the total items to get the dailyPrice */
              const scheduleItems = scheduleGrouppedDatesByMonth.find((d) => d.month === record.month && d.year === record.year);

              if (record.paymentType === 'package' || record.paymentType === 'monthly') {
                record['amount'] = monthlyPrice / scheduleItems.items.length;
              } else if (record.paymentType === 'hourly-monthly' || record.paymentType === 'hourly-package') {
                const from = DateTime.fromFormat(schedulesShift.time.from, 'HH:mm');
                const to = DateTime.fromFormat(schedulesShift.time.to, 'HH:mm');
                let diff = to.diff(from, 'hours').hours;
                if (diff < 0) {
                  diff = to.plus({ days: 1 }).diff(from, 'hours').hours;
                }
                let totalPrice = 0;
                if (record.paymentType === 'hourly-monthly') {
                  totalPrice = hourlyMonthlyPrice * diff;
                }
                if (record.paymentType === 'hourly-package') {
                  totalPrice = hourlyPackagePrice * diff;
                }
                record['amount'] = totalPrice;
              }
            }

            // console.log('record', record, monthlyPrice, scheduleItems.items.length);
            return record;
          })
          // .filter((record: IStudentsTuitionAttendanceRecord) => {
          //   const recordDate = DateTime.fromObject({
          //     day: record.day,
          //     month: record.month,
          //     year: record.year,
          //   });

          //   // console.log(
          //   //   differenceInDays(recordDate.toJSDate(), scheduleFromDate.toJSDate()),
          //   //   recordDate.toISODate(),
          //   //   scheduleFromDate.toISODate(),
          //   //   schedulesShift.title,
          //   //   schedulesShift.schedule.fromDate,
          //   //   recordDate.toISODate(),
          //   // );
          //   if (differenceInDays(recordDate.toJSDate(), scheduleFromDate.toJSDate()) >= 0) {
          //     return record;
          //   }
          //   return false;
          // })
          /* remove behind date from schedule */
          .filter((record: IStudentsTuitionAttendanceRecord) => {
            const recordDate = DateTime.fromObject({ day: record.day, month: record.month, year: record.year });
            if (record.month === scheduleFromDate.month && record.year === scheduleFromDate.year) {
              return differenceInDays(recordDate.toJSDate(), scheduleFromDate.toJSDate()) >= 0;
            }
            return true;
          });

        // console.log('sinceFromDate', sinceFromDate);

        const createdStudentsTuitionAttendance = await this.studentsTuitionAttendance.create({
          records: newMappedDates,
          student: body.studentId,
          schedulesShift: schedulesShift._id,
          classes: body.classId,
          status: 'ongoing',
          enrolledBy: tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        });

        paymentHistory.data['records'] = mappedDates;
        this.studentsTuitionAttendance
          .findOneAndUpdate(
            {
              _id: createdStudentsTuitionAttendance._id,
              status: 'ongoing',
            },
            {
              $push: {
                paymentHistory: paymentHistory,
              },
            }
          )
          .then();

        /* save the change log */
        this.studentsTuitionAttendance
          .findOneAndUpdate(
            {
              _id: body.studentClassId,
              student: body.studentId,
              status: 'ongoing',
              properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
              deleted: false,
            },
            {
              $push: {
                changeLogs: {
                  $each: [
                    {
                      id: SYSTEM_ID(),
                      actionType: 'pay-tuition',
                      dateCreated: DateTime.now().toISO(),
                      data: alreadyEnrolled,
                    },
                  ],
                },
              },
            }
          )
          .then();

        // Save the payment
        this.cashflow
          .create({
            notes: 'Tuition payment for newly enrolled student',
            payedBy: body.studentId,
            receivedBy: tokenPayload.accountId,
            tuition: {
              tuitionAttendance: createdStudentsTuitionAttendance._id,
              urlCode: paymentHistory.urlCode,
              dates: [paymentHistory.data.fromDate, paymentHistory.data.toDate],
              className: classes.name,
            },
            amount: paymentHistory.data.deductedTotalAmount,
            mode: 'cash',
            type: 'income',
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
          })
          .then();
      }

      if (!body.cantPayThisMonth) {
        /* set savings */
        this.accounts
          .findOneAndUpdate(
            {
              _id: body.studentId,
              properties: tokenPayload.propertyId,
            },
            {
              $set: {
                saving: classPricing.data.savingsRemainingBalance,
                redundantSaving: classPricing.data.savingsRedundantRemainingBalance,
              },
            }
          )
          .then();

        /* deduct the savings breakdown */
        this.deductSavingsBreakdown(
          {
            savings: {
              savingsBalance: classPricing.data.savingsBalance,
              savingsRemainingBalance: classPricing.data.savingsRemainingBalance,
              savingsRedundantBalance: classPricing.data.savingsRedundantBalance,
              savingsRedundantRemainingBalance: classPricing.data.savingsRedundantRemainingBalance,
            },
            // studentClassId: body.studentClassId,
            studentId: body.studentId,
          },
          tokenPayload
        );

        this.notifications
          .create({
            actionType: 'student-receipt',
            title: 'Receipt',
            message: 'Your receipt has arrived',
            data: { urlCode: paymentHistory.urlCode },
            accounts: body.studentId,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
          })
          .then();

        this.activityLogs
          .create({
            action: 'receive-payment-from-tuition',
            createdBy: tokenPayload.accountId,
            student: body.studentId,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
          })
          .then();
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Transaction complete',
        data: {
          paymentHistory: paymentHistory,
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

  public async stopLearning(
    body: StopLearningDTO,
    studentTuitionAttendanceId: string,
    tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    try {
      const studentsTuitionAttendance = await this.studentsTuitionAttendance.findOne({
        _id: studentTuitionAttendanceId,
        student: body.studentId,
        deleted: false,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      if (isEmpty(studentsTuitionAttendance)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'Student class does not exist',
        });
      }

      const stoppedDate = DateTime.fromSQL(body.stoppedDate); //DateTime.now().toISODate();

      // Get and log proceeding dates
      const notCompletedRecords = studentsTuitionAttendance.records; //.filter((r) => !r.completed && r.included && r.enable);

      const sortNotCompletedRecords = sortBy(notCompletedRecords, ['year', 'month', 'day']);
      const proceedingDates = GetProceedingDates(stoppedDate, sortNotCompletedRecords);

      // console.log('proceedingDates ', JSON.stringify(sortNotCompletedRecords, null, 2));

      /* get the debt */
      // const totalDebts = sortNotCompletedRecords.filter((r) => r.included && r.enable && !r.paid).filter((r) => r.status !== 'off-day');
      const totalDebts = proceedingDates.previousPayments.filter((r) => r.included && r.enable && !r.paid).filter((r) => r.status !== 'off-day');
      const totalAmountDebt = round(totalDebts.reduce((pv, cv) => pv + cv.amount, 0));

      console.log('redundantSavings proceedingDates ', proceedingDates.remainingPayments.length);

      /* get the to be save amount to redundant */
      const redundantSavings = proceedingDates.remainingPayments.filter(
        (r) => r.included && r.enable && r.paid && r.status !== 'off-day' && (r.paymentType === 'monthly' || r.paymentType === 'hourly-monthly')
      );
      console.log('redundantSavings', redundantSavings.length);
      // console.log('redundantSavings ', JSON.stringify(redundantSavings, null, 2));
      const totalAmountOfRedundantSavings = round(redundantSavings.reduce((pv, cv) => pv + cv.amount, 0));

      /* get the off-days */
      const offDays = proceedingDates.remainingPayments.filter((r) => r.paidOffDay && r.paid && r.status === 'off-day');

      // extract the to be excluded date
      if (body.action === 'request') {
        return ResponseHandlerService({
          success: true,
          httpCode: HttpStatus.OK,
          statusCode: STATUS_CODE.OK,
          data: { debt: totalAmountDebt, redundantSavings: totalAmountOfRedundantSavings, offDays: offDays, stoppedDate, proceedingDates },
        });
      }

      // console.log('totalAmountOfRedundantSavings', totalAmountOfRedundantSavings);
      /* save the savings */
      this.accounts
        .findOneAndUpdate(
          {
            _id: body.studentId,
            properties: tokenPayload.propertyId,
          },
          { $inc: { redundantSaving: totalAmountOfRedundantSavings } }
        )
        .then();

      /* mark the remaining dates as included=true, enable = false, paid = false, remainingInMonth=false */
      for await (const remainingPayment of proceedingDates.remainingPayments) {
        await this.studentsTuitionAttendance.updateOne(
          {
            _id: studentTuitionAttendanceId,
            status: 'ongoing',
            records: {
              $elemMatch: {
                day: remainingPayment.day,
                month: remainingPayment.month,
                year: remainingPayment.year,
              },
            },
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
          },
          {
            $set: {
              'records.$.included': true,
              'records.$.enable': false,
              'records.$.stoppedLearning': true,
            },
          }
        );
      }

      /* save to saving breakdown */
      for await (const redundantSaving of redundantSavings) {
        await this.saveSavingsBreakdown(
          {
            studentTuitionAttendanceId: studentTuitionAttendanceId,
            studentId: body.studentId,
            attendanceInRecord: redundantSaving,
            studentsTuitionAttendance: studentsTuitionAttendance,
            type: 'stop-learning',
          },
          tokenPayload
        );
      }

      this.studentsTuitionAttendance
        .findOneAndUpdate(
          {
            _id: studentTuitionAttendanceId,
            classes: body.classId,
            student: body.studentId,
            status: 'ongoing',
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
            deleted: false,
          },
          {
            $set: { status: 'stopped', reason: body.reason },
          }
        )
        .then();

      // this.accounts.findOneAndUpdate({ _id: body.studentId }, { $set: { active: false } }).then(() => {
      // this.inactiveAccountScheduler.processAction({
      //   action: 'to-be-inactive',
      //   accountId: body.studentId,
      // });
      // });

      this.activityLogs
        .create({
          action: 'student-stop-learning',
          createdBy: tokenPayload.accountId,
          student: body.studentId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        })
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

  public async setVersion(
    body: SetVersionClassTuitionPaymentDTO,
    studentClassId: string,
    tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    try {
      const studentsTuitionAttendance = await this.studentsTuitionAttendance.findOne({
        _id: studentClassId,
        status: 'ongoing',
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
        deleted: false,
      });

      if (isEmpty(studentsTuitionAttendance)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'Student class does not exist',
        });
      }

      const schedulesShift = await this.schedulesShifts.findOne({
        _id: studentsTuitionAttendance.schedulesShift,
      });

      if (isEmpty(body.versionId)) {
        const associatedClass = await this.classes.aggregate([
          {
            $match: {
              _id: studentsTuitionAttendance.classes,
              deleted: false,
              properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
            },
          },
          { $lookup: { from: 'courses', foreignField: '_id', localField: 'courses', as: 'courses' } },
          { $unwind: '$courses' },
        ]);

        const monthlyPrice = associatedClass[0].courses.price;

        const resetRecords = studentsTuitionAttendance.records.map((record) => {
          // const recordDate = DateTime.fromObject({
          //   day: record.day,
          //   month: record.month,
          //   year: record.year,
          // });

          // default value of record
          const updatedRecord: any = {
            included: false,
            enable: false,
            day: record.day,
            month: record.month,
            year: record.year,
            paid: false,
            paymentType: null,
          };

          /* get the total items to get the dailyPrice */
          const recordItem = studentsTuitionAttendance.records.find((d) => d.month === record.month && d.year === record.year);
          const scheduleFromDate = DateTime.fromObject({ day: recordItem.day, month: recordItem.month, year: recordItem.year }).startOf('month');
          const scheduleToDate = scheduleFromDate.endOf('month');
          const allDaysInAMonthOfScheduleRRule = ComposedRRule({
            ...schedulesShift.schedule,
            fromDate: scheduleFromDate.toJSDate(), //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromDate as any).toJSDate(),
            fromTime: scheduleFromDate.toJSDate(), //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromTime as any).toJSDate(),
            allDay: true,
            toDate: scheduleToDate.toJSDate(),
            toTime: scheduleToDate.toJSDate(), // DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.toTime as any).toJSDate()
          } as any);

          updatedRecord['id'] = SYSTEM_ID();
          updatedRecord['amount'] = monthlyPrice / allDaysInAMonthOfScheduleRRule.approximate.all().length; //.items.filter((d) => d.enable && d.included).length;
          updatedRecord['completed'] = false;
          return updatedRecord;
        });

        await this.studentsTuitionAttendance.findOneAndUpdate(
          {
            _id: studentClassId,
            status: 'ongoing',
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
            deleted: false,
          },
          {
            $set: {
              records: resetRecords,
              paymentHistory: [],
            },
          },
          { new: true }
        );
      } else {
        const changeLog = studentsTuitionAttendance.changeLogs.find((c) => c.id === body.versionId);
        if (isEmpty(changeLog)) {
          return ResponseHandlerService({
            success: false,
            httpCode: HttpStatus.NOT_FOUND,
            statusCode: STATUS_CODE.NOT_FOUND,
            message: 'Version does not exist',
          });
        }
        await this.studentsTuitionAttendance.findOneAndUpdate(
          {
            _id: studentClassId,
            status: 'ongoing',
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
            deleted: false,
          },
          {
            $set: {
              records: changeLog.data.records,
              paymentHistory: changeLog.data.paymentHistory,
            },
          }
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

  public async versions(studentClassId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const studentsTuitionAttendance = await this.studentsTuitionAttendance.findOne({
        _id: studentClassId,
        status: 'ongoing',
        deleted: false,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      if (isEmpty(studentsTuitionAttendance)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'Student class does not exist',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: studentsTuitionAttendance.changeLogs,
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

  public async markAttendance(body: MarkAttendanceDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      for await (const record of body.records) {
        const studentsTuitionAttendance = await this.studentsTuitionAttendance.findOne({
          _id: record.studentTuitionAttendanceId,
          student: record.studentId,
          status: 'ongoing',
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        });

        let attendanceInRecord = null;

        if (!isEmpty(studentsTuitionAttendance)) {
          attendanceInRecord = studentsTuitionAttendance.records.find(
            (r) => r.day === record.day && r.month === record.month && r.year === record.year
          );
        }

        /* Monthly = when marking as off-day then save the amount to savings */
        /* Package = when marking as off-day then extend the package to next day of class */
        if (record.status === 'off-day') {
          const schedulesShift = await this.schedulesShifts.findOne({
            classes: studentsTuitionAttendance.classes,
            deleted: false,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
          });
          // const schedulesShift = schedulesShifts[0];
          // console.log('schedulesShift', schedulesShift);

          const classPricing = await this.classPricing(
            {
              classId: studentsTuitionAttendance.classes as any as string,
              studentId: record.studentId,
              studentClassId: record.studentTuitionAttendanceId,
              dates: [record] as any as [],
              discount: 0,
              addition: 0,
              subtraction: 0,
              notes: null,
              cantPayThisMonth: false,
              payDebt: false,
              newEnroll: false,
            },
            tokenPayload
          );

          // console.log('classPricing', classPricing.data, record);

          if (classPricing.success) {
            const classPricingData: { offDays: Array<IStudentsTuitionAttendanceRecord>; totalOfOffDays: number } = classPricing.data;
            // if student has a off day in the record, then use it to mark as paid
            if (classPricingData.totalOfOffDays > 0) {
              record['paid'] = classPricingData.offDays[0].paid;
              record['amount'] = classPricingData.offDays[0].amount;
              record['paymentHistoryId'] = classPricingData.offDays[0].paymentHistoryId;
              record['paymentType'] = classPricingData.offDays[0].paymentType;
              record['notes'] = classPricingData.offDays[0].notes;
            }
          }

          const offDayDate = DateTime.fromISO(`${record.year}-${record.month.toString().padStart(2, '0')}-${record.day.toString().padStart(2, '0')}`);

          const dates: Array<IStudentsTuitionAttendanceRecord> = [];
          studentsTuitionAttendance.records.forEach((record) => {
            const recordMonth = record.month.toString().padStart(2, '0'); // 9 becomes 09
            const recordDay = record.day.toString().padStart(2, '0'); // 9 becomes 09
            const recordDate = DateTime.fromISO(`${record.year}-${recordMonth}-${recordDay}`); // 2017-09-24

            const isRecordDateExist = dates.find((d) => {
              const dMonth = d.month.toString().padStart(2, '0'); // 9 becomes 09
              const dDay = d.day.toString().padStart(2, '0'); // 9 becomes 09
              const date = DateTime.fromISO(`${d.year}-${dMonth}-${dDay}`); // 2017-09-24
              return date.month === recordDate.month && date.year === recordDate.year;
            });

            // console.log('isRecordDateExist', dates, isRecordDateExist);

            if (isEmpty(isRecordDateExist)) {
              const dMonth = record.month.toString().padStart(2, '0'); // 9 becomes 09
              const dDay = record.day.toString().padStart(2, '0'); // 9 becomes 09
              const date = DateTime.fromISO(`${record.year}-${dMonth}-${dDay}`); // 2017-09-24
              dates.push({ ...record, date: date } as any);
            }
          });

          // console.log('>>>', studentsTuitionAttendance.records, dates);
          // console.log('after ', record);

          /* analyze the date */
          const dateInterval: Array<{ date: DateTime; year: number; month: number; days: Array<{ enable: boolean; date: DateTime }> }> = [];

          const currentDate = DateTime.now().setZone('utc');

          // Sort the array of objects by date
          const sortedRecords = studentsTuitionAttendance.records
            .sort((a, b) => CompareDates(a, b))
            .map((record) => {
              const dMonth = record.month.toString().padStart(2, '0'); // 9 becomes 09
              const dDay = record.day.toString().padStart(2, '0'); // 9 becomes 09
              const date = DateTime.fromISO(`${record.year}-${dMonth}-${dDay}`, { zone: 'UTC' }); // 2017-09-24
              record['date'] = date;
              return record;
            });

          const _fromDateMonth = sortedRecords[0].month.toString().padStart(2, '0'); // 9 becomes 09
          const _fromDateDay = sortedRecords[0].day.toString().padStart(2, '0'); // 9 becomes 09
          const fromDate = new Date(`${sortedRecords[0].year}-${_fromDateMonth}-${_fromDateDay}`); //currentDate.startOf('day'); //dates[0]['date'];

          // if (!currentDate.hasSame(fromDate, 'month')) {
          //            // }

          const _toDate = sortedRecords[sortedRecords.length - 1];
          const _toDateMonth = _toDate.month.toString().padStart(2, '0'); // 9 becomes 09
          const _toDateDay = _toDate.day.toString().padStart(2, '0'); // 9 becomes 09
          const toDate = new Date(`${record.year}-${_toDateMonth}-${_toDateDay}`); //DateTime.fromISO(`${record.year}-${_toDateMonth}-${_toDateDay}`).endOf('day').setZone('utc');
          // this.formGroup.value.paymentType === 'monthly' ? DateTime.fromJSDate(this.formGroup.value.fromDate).endOf('month') : DateTime.fromJSDate(this.formGroup.value.toDate).endOf('month');

          // console.log('fromDate', fromDate, 'toDate', toDate);

          // const includeDaysInAWeek: number[] = [0, 1, 2, 3, 4, 5, 6]; // equivalent of Sunday to Saturday

          // console.log("pricing => ", this.pricing);

          // console.log("schedule => ", this.pricing.schedulesShift.schedules.schedule);

          // console.log("timee => ", {
          //   fromDate: fromDate, //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromDate as any).toJSDate(),
          //   fromTime: fromDate, //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromTime as any).toJSDate(),
          //   toDate: fromDate.endOf("month").toJSDate(),
          //   toTime: fromDate.endOf("month").toJSDate() //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.toTime as any).toJSDate()
          // });

          const allDaysInAMonthOfScheduleRRule = ComposedRRule({
            // ...schedulesShift.schedules.schedule,
            // toTimezone: 'Asia/Manila',
            recurrence: {
              freq: RRule.DAILY,
              interval: 1,
            },
            fromDate: fromDate, //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromDate as any).toJSDate(),
            fromTime: fromDate, //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromTime as any).toJSDate(),
            allDay: true,
            toDate: toDate,
            toTime: toDate, // DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.toTime as any).toJSDate()
          } as any);

          // console.log('composedRRule total >> ', composedRRule.approximate.all().length);

          // console.log('allDaysInAMonthOfScheduleRRule ', allDaysInAMonthOfScheduleRRule);

          // console.log('composedRRule.approximate.all() ', allDaysInAMonthOfScheduleRRule.approximate.all());
          allDaysInAMonthOfScheduleRRule.approximate.all().forEach((date) => {
            const luxonDate = DateTime.fromJSDate(date);
            const isExistIndex = dateInterval.findIndex((d) => d.month === luxonDate.month && d.year === luxonDate.year);
            if (isExistIndex === -1) {
              dateInterval.push({ date: luxonDate, year: luxonDate.year, month: luxonDate.month, days: [{ enable: true, date: luxonDate }] });
            } else {
              dateInterval[isExistIndex].days.push({ enable: true, date: luxonDate });
            }
          });

          // console.log(
          //   '\n',
          //   'dateInterval >> ',
          //   allDaysInAMonthOfScheduleRRule.approximate.options,
          //   dateInterval.map((d) => d.date.toISODate()),
          //   '\n\n\n\n ',
          // );

          // get the last month
          // compare the days of that month if theres a available in class schedule
          // if yes then, use it to extend.

          const extendedToDate = DateTime.fromJSDate(toDate).plus({ months: 1 }).toJSDate();
          const scheduleComposedRRule = ComposedRRule({
            ...schedulesShift.schedule,
            fromDate: fromDate, //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromDate as any).toJSDate(),
            fromTime: fromDate, //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromTime as any).toJSDate(),
            fromTimezone: 'UTC',
            allDay: true,
            toDate: extendedToDate,
            toTime: extendedToDate, // DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.toTime as any).toJSDate()
            toTimezone: 'UTC',
          } as any);

          // console.log('scheduleComposedRRule ', scheduleComposedRRule.approximate.all());

          // const lastSortedRecords = sortedRecords[sortedRecords.length - 1];

          // const toBeExtendDate = scheduleComposedRRule.approximate.all().find((rDate) => {
          //   // find the lastSortedRecords in rrule dates
          //   // if match(not paid) then go to next index of rrule
          //   //
          //   //
          //   //
          //   //  Attendance date: 2024-02-23T00:00:00.000Z - off-day
          //   //  rrule:
          //   //  [
          //   //     2024-02-09T00:00:00.000Z,
          //   //     2024-02-12T00:00:00.000Z,
          //   //     2024-02-16T00:00:00.000Z,
          //   //     2024-02-19T00:00:00.000Z,
          //   //     2024-02-23T00:00:00.000Z, // hit off day then go next day
          //   //     2024-02-26T00:00:00.000Z,
          //   //     2024-03-01T00:00:00.000Z,
          //   //     2024-03-04T00:00:00.000Z,
          //   //     2024-03-08T00:00:00.000Z,
          //   //     2024-03-11T00:00:00.000Z,
          //   //     2024-03-15T00:00:00.000Z,
          //   //     2024-03-18T00:00:00.000Z,
          //   //     2024-03-22T00:00:00.000Z,
          //   //     2024-03-25T00:00:00.000Z
          //   //   ]
          //   //
          //   //
          //   //
          //   const scheduleDateExist = sortedRecords.find((sDate) => {
          //     /* check if `scheduleComposedRRule` exist in  */
          //     return rDate < sDate.date.toJSDate() && rDate > offDayDate.toJSDate(); //DateTime.fromJSDate(rDate) === sDate;
          //   });

          //   // console.log('scheduleDateExist', scheduleDateExist);
          //   return scheduleDateExist;
          // });

          // const inRecordsDates = sortedRecords.map((d) => d.date.toISO());
          // console.log('toBeExtendDate', offDayDate.toISO(), inRecordsDates, toBeExtendDate);

          // update the status

          const lastEnrolledDate = sortedRecords[sortedRecords.length - 1];

          // console.log(
          //   'lastEnrolledDate ',
          //   lastEnrolledDate.date.toISO(),
          //   sortedRecords.map((r) => r.date.toISO()),
          // );

          /* check in current records if exists */
          const existInCurrentRecordIndex = sortedRecords.findIndex(
            (r) => record.day === r.day && record.month === r.month && record.year === r.year
          );

          const nextExistInCurrentRecordIndex = sortedRecords[existInCurrentRecordIndex + 1]
            ? existInCurrentRecordIndex + 1
            : existInCurrentRecordIndex + 1;

          const getAvailableNextDay = GetAvailableNextDay(existInCurrentRecordIndex + 1, sortedRecords);

          // console.log('existInCurrentRecords >>> ', existInCurrentRecordIndex, nextExistInCurrentRecordIndex, getAvailableNextDay);

          if (existInCurrentRecordIndex !== -1 && getAvailableNextDay) {
            // console.log('just update', getAvailableNextDay);
            // console.log('sortedRecords > before ', JSON.stringify(sortedRecords, null, 2));

            delete getAvailableNextDay.record.date;

            let getAvailableNextDayRecord = getAvailableNextDay.record;

            // /* if current record is equal to available next day then  */
            // if (getAvailableNextDayRecord.month === record.month && getAvailableNextDayRecord.year === record.year) {
            //   console.log('yes equal');
            //   getAvailableNextDayRecord = {
            //     ...getAvailableNextDayRecord,
            //     paid: attendanceInRecord.paid,
            //   };
            // } else {
            //   console.log('not equal');
            getAvailableNextDayRecord = {
              ...getAvailableNextDayRecord,
              amount: attendanceInRecord.amount,
              paid: attendanceInRecord.paid,
              paymentType: attendanceInRecord.paymentType,
              paymentHistoryId: attendanceInRecord.paymentHistoryId,
            };
            // }

            if (attendanceInRecord.paymentType === 'package' || attendanceInRecord.paymentType === 'hourly-package') {
              sortedRecords[getAvailableNextDay.index] = {
                ...getAvailableNextDayRecord,
                included: true,
                enable: true,
              };
              // console.log('getAvailableNextDayRecord', getAvailableNextDayRecord, sortedRecords[getAvailableNextDay.index]);
            }

            /* if the day is off-day and !include and !enable then make it include=true and enable=true */
            const { included, enable } = sortedRecords[existInCurrentRecordIndex];
            if (!included && !enable) {
              sortedRecords[existInCurrentRecordIndex] = {
                ...sortedRecords[existInCurrentRecordIndex],
                included: true,
                enable: true,
              };
            }
          } else {
            return ResponseHandlerService({
              success: false,
              httpCode: HttpStatus.NOT_FOUND,
              statusCode: STATUS_CODE.NOT_FOUND,
              message: 'The next date should update.',
            });
            // /* add new month if not exist in current records */
            // const toBeExtendDateIndex = scheduleComposedRRule.approximate.all().findIndex((date) => {
            //   const equalDate = lastEnrolledDate.date.equals(DateTime.fromJSDate(date, { zone: 'UTC' }));
            //   // console.log('equalDate', equalDate, lastEnrolledDate.date.toISO(), DateTime.fromJSDate(date, { zone: 'UTC' }).toISO());
            //   return equalDate ? equalDate : null;
            // });

            // const toBeExtendDate = scheduleComposedRRule.approximate.all()[toBeExtendDateIndex + 1];

            // // console.log('toBeExtendDateIndex ', toBeExtendDateIndex, ' = ', toBeExtendDate, JSON.stringify(scheduleComposedRRule.approximate.all(), null, 2));

            // /* insert the extended date with the value of previous record */
            // if (toBeExtendDateIndex !== -1) {
            //   const extendDate = DateTime.fromJSDate(toBeExtendDate, { zone: 'UTC' });

            //   // console.log('attendanceInRecord', extendDate.toISO(), attendanceInRecord, record);

            //   const attendanceInRecordToExtend = attendanceInRecord;
            //   delete attendanceInRecordToExtend.status; // delete status

            //   console.log('attendanceInRecord.paymentType', attendanceInRecord.paymentType);
            //   // console.log('sortedRecords before ', JSON.stringify(sortedRecords, null, 2));

            //   scheduleComposedRRule.approximate
            //     .all()
            //     .filter((date) => {
            //       const convertedDate = DateTime.fromJSDate(date);
            //       return extendDate.month === convertedDate.month && extendDate.year === convertedDate.year;
            //     })
            //     .forEach((date) => {
            //       const convertedDate = DateTime.fromJSDate(date);

            //       const existInSortedRecordIndex = sortedRecords.findIndex((r) => r.day === convertedDate.day && r.month === convertedDate.month && r.year === convertedDate.year);

            //       /* if exist in sortedRecords, that means it has a record before so just update the record */
            //       if (existInSortedRecordIndex >= 0) {
            //         // sortedRecords[sortedRecordIndex].status;
            //         if (extendDate.day === convertedDate.day && extendDate.month === convertedDate.month && extendDate.year === convertedDate.year) {
            //         }
            //       } else {
            //         /* if first time, push the new record */
            //         if (extendDate.day === convertedDate.day && extendDate.month === convertedDate.month && extendDate.year === convertedDate.year) {
            //           console.log('firstime');
            //           sortedRecords.push({
            //             ...attendanceInRecordToExtend, // include previous record
            //             included: true,
            //             enable: true,
            //             status: null,
            //             id: SYSTEM_ID(),
            //             day: convertedDate.day,
            //             month: convertedDate.month,
            //             year: convertedDate.year,
            //             hour: convertedDate.hour,
            //             minute: convertedDate.minute,
            //             notes: record?.notes || null,
            //             createdAt: DateTime.now().toISO(),
            //           });
            //         } else {
            //           console.log('not firstime');
            //           // let getAvailableNextDayRecord = getAvailableNextDay.record;
            //           // /* if current record is equal to available next day then  */
            //           // if (getAvailableNextDayRecord.month === record.month && getAvailableNextDayRecord.year === record.year) {
            //           //   console.log('yes equal');
            //           // } else {
            //           //   console.log('not equal');
            //           //   getAvailableNextDayRecord = {
            //           //     ...getAvailableNextDayRecord,
            //           //     amount: attendanceInRecord.amount,
            //           //     paid: attendanceInRecord.paid,
            //           //     paymentType: attendanceInRecord.paymentType,
            //           //     paymentHistoryId: attendanceInRecord.paymentHistoryId,
            //           //   };
            //           // }

            //           sortedRecords.push({
            //             paymentHistoryId: null,
            //             paymentType: null,
            //             savingsConsumed: false,
            //             stoppedLearning: false,
            //             included: true,
            //             enable: false,
            //             status: null,
            //             paid: false,
            //             amount: 0,
            //             id: SYSTEM_ID(),
            //             day: convertedDate.day,
            //             month: convertedDate.month,
            //             year: convertedDate.year,
            //             hour: convertedDate.hour,
            //             minute: convertedDate.minute,
            //             notes: null,
            //             completed: false,
            //             createdAt: DateTime.now().toISO(),
            //           });
            //         }
            //       }
            //     });
            // }
          }

          if (attendanceInRecord.paymentType === 'monthly' || attendanceInRecord.paymentType === 'hourly-monthly') {
            if (attendanceInRecord.paid) {
              // save to savings
              this.accounts
                .findOneAndUpdate(
                  {
                    _id: record.studentId,
                    properties: tokenPayload.propertyId,
                  },
                  { $inc: { saving: attendanceInRecord.amount } }
                )
                .then();
            }
          }
          // else {
          // extend the package
          const latestSortedRecords = sortBy(
            sortedRecords.map((r) => {
              delete r.date;
              return r;
            }),
            ['year', 'month', 'day']
          );

          await this.studentsTuitionAttendance.findOneAndUpdate(
            {
              _id: record.studentTuitionAttendanceId,
              student: record.studentId,
              deleted: false,
            },
            {
              // $push: {
              //   records: {
              //     $each: [
              //       {
              //         ...attendanceInRecordToExtend, // include previous record
              //         included: true,
              //         enable: true,
              //         status: null,
              //         id: SYSTEM_ID(),
              //         day: extendDate.day,
              //         month: extendDate.month,
              //         year: extendDate.year,
              //         hour: extendDate.hour,
              //         minute: extendDate.minute,
              //         notes: record?.notes || null,
              //         createdAt: DateTime.now().toISO(),
              //       },
              //     ],
              //     $sort: { year: 1, month: 1, day: 1 },
              //   },
              // },
              $set: {
                records: latestSortedRecords,
              },
            }
          );

          /* save to saving breakdown */
          this.saveSavingsBreakdown(
            {
              studentTuitionAttendanceId: record.studentTuitionAttendanceId,
              studentId: record.studentId,
              attendanceInRecord: attendanceInRecord,
              studentsTuitionAttendance: studentsTuitionAttendance,
              type: 'off-day',
            },
            tokenPayload
          );

          // }
        }

        if (isEmpty(studentsTuitionAttendance)) {
          return ResponseHandlerService({
            success: false,
            httpCode: HttpStatus.NOT_FOUND,
            statusCode: STATUS_CODE.NOT_FOUND,
            message: 'Class does not exist on this student',
          });
        } else {
          /**
           * If record.day,month,year does not exist then it will become part of debt
           * Insert attendance in record but paid=false
           */
          if (isEmpty(attendanceInRecord)) {
            this.studentsTuitionAttendance
              .findOneAndUpdate(
                {
                  _id: record.studentTuitionAttendanceId,
                  student: record.studentId,
                  status: 'ongoing',
                  deleted: false,
                },
                {
                  $push: {
                    records: {
                      $each: [
                        {
                          day: record.day,
                          month: record.month,
                          year: record.year,
                          hour: record.hour,
                          minute: record.minute,
                          status: record.status,
                          notes: record?.notes || null,
                          paid: false,
                          createdAt: DateTime.now().toISO(),
                        },
                      ],
                      $sort: { year: 1, month: 1, day: 1 },
                    },
                  },
                }
              )
              .then();
          }

          /* Mark attendance if attendance is already exist and no debt */
          if (!isEmpty(attendanceInRecord)) {
            /* make sure to test well when it comes to tuition payment scenarios */
            if (record.status === 'unmark') {
              this.studentsTuitionAttendance
                .updateOne(
                  {
                    _id: record.studentTuitionAttendanceId,
                    student: record.studentId,
                    status: 'ongoing',
                    records: {
                      $elemMatch: {
                        day: record.day,
                        month: record.month,
                        year: record.year,
                        // status: { $eq: null }, // if attendance doest no have status meaning thats not yet setted an attendance
                      },
                    },
                    properties: tokenPayload.propertyId,
                    propertiesBranches: tokenPayload.branchId,
                  },
                  {
                    $set: {
                      'records.$.status': null,
                    },
                  }
                )
                .then();

              /* deduct saving if the previous status is off-day */
              // if (attendanceInRecord.status === 'off-day' && record.status !== 'unmark') {
              //   if (attendanceInRecord.paymentType === 'monthly') {
              //     this.accounts
              //       .findOneAndUpdate(
              //         {
              //           _id: record.studentId,
              //           properties: tokenPayload.propertyId,
              //         },
              //         { $inc: { saving: -attendanceInRecord.amount } },
              //       )
              //       .then();
              //   } else {
              //     // TODO: package
              //   }
              // }
            } else {
              if (record.status === 'off-day') {
                await this.studentsTuitionAttendance.updateOne(
                  {
                    _id: record.studentTuitionAttendanceId,
                    student: record.studentId,
                    records: {
                      $elemMatch: {
                        day: record.day,
                        month: record.month,
                        year: record.year,
                      },
                    },
                    properties: tokenPayload.propertyId,
                    propertiesBranches: tokenPayload.branchId,
                  },
                  {
                    $set: {
                      'records.$.included': true,
                      'records.$.enable': false,
                      'records.$.paidOffDay': attendanceInRecord.paid,
                      'records.$.status': record.status,
                      'records.$.hour': record.hour,
                      'records.$.minute': record.minute,
                      'records.$.notes': record.notes,
                      createdAt: DateTime.now().toISO(),
                    },
                  }
                );
              } else {
                await this.studentsTuitionAttendance.updateOne(
                  {
                    _id: record.studentTuitionAttendanceId,
                    student: record.studentId,
                    status: 'ongoing',
                    records: {
                      $elemMatch: {
                        day: record.day,
                        month: record.month,
                        year: record.year,
                        // status: { $eq: null }, // if attendance doest no have status meaning thats not yet setted an attendance
                      },
                    },
                    properties: tokenPayload.propertyId,
                    propertiesBranches: tokenPayload.branchId,
                  },
                  {
                    $set: {
                      'records.$.included': true,
                      'records.$.enable': true,

                      'records.$.status': record.status,
                      'records.$.hour': record.hour,
                      'records.$.minute': record.minute,
                      'records.$.notes': record.notes,
                      createdAt: DateTime.now().toISO(),
                    },
                  }
                );
              }
            }
          }
        }
      } // end of off-day

      // const studentInfo = await this.studentInfo(body.studentId);
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully submitted',
      });
    } catch (error) {
      console.log('error', error);
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  // public async stopLearningAccumulated(body: StopLearningDTO, studentClassId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   try {
  //     const studentsTuitionAttendance = await this.studentsTuitionAttendance.findOne({
  //       classes: body.classId,
  //       student: body.studentId,
  //       deleted: false,
  //       properties: tokenPayload.propertyId,
  //       propertiesBranches: tokenPayload.branchId,
  //     });

  //     return ResponseHandlerService({
  //       success: true,
  //       httpCode: HttpStatus.OK,
  //       statusCode: STATUS_CODE.HAS_DATA,
  //       data: {},
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

  public async classPricing(body: ClassPricingDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      // if (isEmpty(body.dates) && body.newEnroll) {
      //   return ResponseHandlerService({
      //     success: true, // true - just to notify the FE that newenroll must have dates
      //     httpCode: HttpStatus.NOT_ACCEPTABLE,
      //     statusCode: STATUS_CODE.UNPROCESSABLE_DATA,
      //     message: 'No dates available',
      //   });
      // }

      const studentsTuitionAttendance = await this.studentsTuitionAttendance.findOne({
        _id: body.studentClassId,
        classes: body.classId,
        student: body.studentId,
        deleted: false,
      });

      // console.log('studentsTuitionAttendance', studentsTuitionAttendance);

      const schedulesShift: SchedulesShifts = await this.schedulesShifts.findOne({
        classes: body.classId,
        deleted: false,
        // properties: tokenPayload.propertyId,
        // propertiesBranches: tokenPayload.branchId,
      });

      if (isEmpty(schedulesShift?.schedule)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.CONFLICT,
          statusCode: STATUS_CODE.UNPROCESSABLE_DATA,
          message: 'Please setup first the schedule for the selected class.',
        });
      }

      const includedClass = body.dates.filter((d) => d.included && d.enable);

      const associatedClass = await this.classes.aggregate([
        { $match: { _id: body.classId, deleted: false, properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId } },
        { $lookup: { from: 'courses', foreignField: '_id', localField: 'courses', as: 'courses' } },
        { $unwind: '$courses' },
      ]);

      /* @BASE_PRICE is monthly price */
      /* Monthly Price/No. of Days = Daily Price */
      // const BASE_PRICE = (associatedClass[0] as Classes).courses.price;
      const monthlyPrice = (associatedClass[0] as Classes).courses.price;
      const hourlyMonthlyPrice = (associatedClass[0] as Classes).courses.hourlyMonthlyPrice;
      const hourlyPackagePrice = (associatedClass[0] as Classes).courses.hourlyPackagePrice;

      // let totalAmountOfDebt = 0;
      let unpaidDaysInRecords: Array<IStudentsTuitionAttendanceRecord> = [];
      let offDays = [];
      let totalOfOffDays = 0;
      let totalAmountOfOffDays = 0;
      // let totalDebtDays = 0;
      let payTuition = false;

      /* if student is already enrolled */
      if (!isEmpty(studentsTuitionAttendance)) {
        offDays = studentsTuitionAttendance.records.filter((r) => r.status === 'off-day' && r.paid);
        totalOfOffDays = offDays.length;
        totalAmountOfOffDays = offDays.reduce((pv, cv) => pv + cv.amount, 0);

        unpaidDaysInRecords = studentsTuitionAttendance.records.filter((r) => !r.paid && r.enable && r.included && r.status !== 'off-day');
        // console.log('unpaidDays', unpaidDays);
        // totalDebtDays = unpaidDates.length;
        // console.log('totalDebtDays', totalDebtDays);
        // totalAmountOfDebt = unpaidDays.reduce((pv, cv) => pv + BASE_PRICE, 0);
        payTuition = true;
      } else {
        /* if student is not yet enrolled */
      }

      if (body.cantPayThisMonth) {
        payTuition = false;
      }

      const totalAddedDays = includedClass.length;

      const student = await this.accounts.findOne({ _id: body.studentId, properties: tokenPayload.queryIds.propertyId });
      // console.log('student', student);

      const savingsBalance = student.saving;
      const savingsRedundantBalance = student.redundantSaving;

      // const discount = isPackage ? body.discount : 0;
      const discount = body.discount;

      const totalOfClassDaysToPay = unpaidDaysInRecords.length + totalAddedDays;
      const classDaysToPay = [...unpaidDaysInRecords, ...includedClass];

      let totalAmountOfAddedDays = 0;

      /* if the record is not yet created */
      if (isEmpty(studentsTuitionAttendance)) {
        const scheduleFromDate =
          includedClass.length > 0
            ? DateTime.fromObject({
                day: includedClass.at(0).day,
                month: includedClass.at(0).month,
                year: includedClass.at(0).year,
              }).startOf('month')
            : DateTime.fromISO(schedulesShift.startDate);

        // console.log('scheduleFromDate', scheduleFromDate);
        // DateTime.fromISO(schedulesShift.startDate);
        const currentDate = DateTime.now();
        // const diffOfFromDateAndScheduleStartDate: number = differenceInDays(scheduleFromDate.toJSDate(), fromDate.toJSDate());
        // console.log('diffOfFromDateAndScheduleStartDate ', diffOfFromDateAndScheduleStartDate);
        // if (diffOfFromDateAndScheduleStartDate > 0) {
        //   scheduleFromDate = scheduleStartDate;
        // } else {
        const currentDateIsGreaterThanScheduleStartDate: boolean =
          differenceInDays(currentDate.toJSDate(), schedulesShift.startDate) > 0 ? false : true;

        const scheduleToDate =
          includedClass.length > 0
            ? DateTime.fromObject({
                day: includedClass.at(-1).day,
                month: includedClass.at(-1).month,
                year: includedClass.at(-1).year,
              }).endOf('month')
            : DateTime.fromISO(schedulesShift.schedule.toDate as any);

        const allDaysInAMonthOfScheduleRRule = ComposedRRule({
          ...schedulesShift.schedule,
          fromDate: scheduleFromDate.toJSDate(), //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromDate as any).toJSDate(),
          fromTime: scheduleFromDate.toJSDate(), //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromTime as any).toJSDate(),
          allDay: true,
          toDate: scheduleToDate.toJSDate(),
          toTime: scheduleToDate.toJSDate(), // DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.toTime as any).toJSDate()
        } as any);

        // console.log('>>>>', scheduleToDate, allDaysInAMonthOfScheduleRRule.approximate.all());

        const scheduleGrouppedDatesByMonth: Array<{
          date: string;
          year: number;
          month: number;
          items: Array<{ paymentType: string; date: string; enable: boolean; included: boolean }>;
        }> = [];
        allDaysInAMonthOfScheduleRRule.approximate.all().forEach((date) => {
          const luxonDate = DateTime.fromJSDate(date);
          const isExistIndex = scheduleGrouppedDatesByMonth.findIndex((d) => d.month === luxonDate.month && d.year === luxonDate.year);

          const existInBodyDates = body.dates.find((d) => d.day === luxonDate.day && d.month === luxonDate.month && d.year === luxonDate.year);

          if (existInBodyDates) {
            if (isExistIndex === -1) {
              scheduleGrouppedDatesByMonth.push({
                date: luxonDate.toISO(),
                year: luxonDate.year,
                month: luxonDate.month,
                items: [
                  {
                    date: luxonDate.toISO(),
                    paymentType: existInBodyDates.paymentType,
                    enable: existInBodyDates ? existInBodyDates.enable : false,
                    included: existInBodyDates ? existInBodyDates.included : false,
                  },
                ],
              });
            } else {
              scheduleGrouppedDatesByMonth[isExistIndex].items.push({
                date: luxonDate.toISO(),
                paymentType: existInBodyDates.paymentType,
                enable: existInBodyDates ? existInBodyDates.enable : false,
                included: existInBodyDates ? existInBodyDates.included : false,
              });
            }
          }
        });

        /* get the total of days from the schedule */
        scheduleGrouppedDatesByMonth.forEach((date) => {
          // const totalDaysInMonth = scheduleGrouppedDatesByMonth.find((d) => d.month === date.month && d.year === date.year);
          const dailyPrice = monthlyPrice / date.items.length;
          // const dailyPrice = monthlyPrice / date.items.length;

          const totalDaysInMonth = date.items.filter((d) => d.enable && d.included);

          totalAmountOfAddedDays += totalDaysInMonth.reduce((pv, cv) => {
            if (cv.paymentType === 'package' || cv.paymentType === 'monthly') {
              return pv + dailyPrice;
            } else if (cv.paymentType === 'hourly-monthly' || cv.paymentType === 'hourly-package') {
              const from = DateTime.fromFormat(schedulesShift.time.from, 'HH:mm');
              const to = DateTime.fromFormat(schedulesShift.time.to, 'HH:mm');

              let diff = to.diff(from, 'hours').hours;
              if (diff < 0) {
                diff = to.plus({ days: 1 }).diff(from, 'hours').hours;
              }
              let totalPrice = 0;
              if (cv.paymentType === 'hourly-monthly') {
                totalPrice = hourlyMonthlyPrice * diff;
              }
              if (cv.paymentType === 'hourly-package') {
                totalPrice = hourlyPackagePrice * diff;
              }
              return pv + totalPrice;
            }
          }, 0);
        });
      } else {
        /* group the days by month to get the price per day based on monthly price */
        const grouppedDatesByMonth: Array<{
          date: string;
          year: number;
          month: number;
          items: Array<{ paymentType: string; enable: boolean; included: boolean; date: IClassPricingDate }>;
        }> = [];
        body.dates.forEach((date) => {
          const luxonDate = DateTime.fromObject({
            day: date.day,
            month: date.month,
            year: date.year,
          });
          const grouppedDatesByMonthIndex = grouppedDatesByMonth.findIndex((e) => e.month === date.month && e.year === date.year);
          if (grouppedDatesByMonthIndex === -1) {
            grouppedDatesByMonth.push({
              date: luxonDate.toISO(),
              year: luxonDate.year,
              month: luxonDate.month,
              items: [{ paymentType: date.paymentType, date: date, enable: date.enable, included: date.included }],
            });
          } else {
            grouppedDatesByMonth[grouppedDatesByMonthIndex].items.push({
              paymentType: date.paymentType,
              date: date,
              enable: date.enable,
              included: date.included,
            });
          }
        });
        grouppedDatesByMonth.forEach((date) => {
          date.items
            .filter((item) => item.included && item.enable) // just incase the user move to debt but skip some of the days
            .forEach((item) => {
              // const dailyPrice = studentsTuitionAttendance.records.find((record) => record.day === item.date.day && record.month === item.date.month && record.year === item.date.year)?.amount || 0;
              const recordsTotal = studentsTuitionAttendance.records.filter(
                (record) => record.month === item.date.month && record.year === item.date.year
              ).length;

              let dailyPrice = 0;
              // console.log('recordsTotal', item.date.month, recordsTotal, dailyPrice);
              // if (dailyPrice > 0) {

              if (item.paymentType === 'package' || item.paymentType === 'monthly') {
                dailyPrice = monthlyPrice / recordsTotal;
              } else if (item.paymentType === 'hourly-monthly' || item.paymentType === 'hourly-package') {
                const from = DateTime.fromFormat(schedulesShift.time.from, 'HH:mm');
                const to = DateTime.fromFormat(schedulesShift.time.to, 'HH:mm');

                let diff = to.diff(from, 'hours').hours;
                if (diff < 0) {
                  diff = to.plus({ days: 1 }).diff(from, 'hours').hours;
                }
                if (item.paymentType === 'hourly-monthly') {
                  dailyPrice = hourlyMonthlyPrice * diff;
                }
                if (item.paymentType === 'hourly-package') {
                  dailyPrice = hourlyPackagePrice * diff;
                }
              }
              totalAmountOfAddedDays += dailyPrice;
              // } else {
              /* if the dailyPrice is 0, meaning it not moved to debt so get the dailyPrice calculation based on schedule  */
              // const dailyPrice = monthlyPrice / date.items.length;
              // const totalDaysInMonth = date.items.filter((d) => d.enable && d.included);
              // console.log(totalDaysInMonth.length);
              //   if(item.enable)
              //   totalAmountOfAddedDays += monthlyPrice / date.items.length; //totalDaysInMonth.reduce((pv, cv) => pv + dailyPrice, 0);
              // }
            });
        });
      }

      const originalTotalAmount = totalAmountOfAddedDays;

      // console.log('totalAmountOfAddedDays ', totalAmountOfAddedDays);
      let deductedTotalAmount = totalAmountOfAddedDays;

      /* deduct discount */
      const totalDiscount = totalAmountOfAddedDays * (discount / 100);
      deductedTotalAmount = deductedTotalAmount - totalDiscount; // 20,000 - 2,000

      // console.log('deductedTotalAmount ', deductedTotalAmount);
      const subTotalAmount = deductedTotalAmount;

      /* add addition */
      deductedTotalAmount = deductedTotalAmount + body.addition; // 18,000 + 500

      /* deduct subtraction */
      deductedTotalAmount = deductedTotalAmount - body.subtraction; // 18,500 - 100

      const subTotalAmountWithoutSavings = deductedTotalAmount;

      /* add the debt */
      const totalAmountOfUnpaidDays = unpaidDaysInRecords.reduce((pv, cv) => pv + cv.amount, 0);
      // console.log('totalAmountOfUnpaidDays', totalAmountOfUnpaidDays);
      // deductedTotalAmount = deductedTotalAmount; //
      /* decide if user wants to pay debt */
      if (body.payDebt && studentsTuitionAttendance.status !== 'ongoing' && body.dates.length === 0) {
        deductedTotalAmount = deductedTotalAmount + totalAmountOfUnpaidDays; //
      }

      /* deduct savings */
      // if (!body.cantPayThisMonth) {
      //   deductedTotalAmount = deductedTotalAmount - savingsBalance;
      // }

      /* savings */
      let savingsRemainingBalance = 0;
      // let usedSavings = 0; // Get the used amount of savings
      let savingsRedundantRemainingBalance = 0;
      let totalAmountOfSavings = 0;
      // console.log('totalAmountOfSavings 1', totalAmountOfSavings);

      if (!body.cantPayThisMonth) {
        totalAmountOfSavings = savingsBalance + savingsRedundantBalance;
        const amountToPay = deductedTotalAmount;

        // totalAmountOfSavings = totalAmountOfSavings - deductedTotalAmount; // deduct savings
        // console.log('totalAmountOfSavings 2', totalAmountOfSavings, deductedTotalAmount);
        deductedTotalAmount = deductedTotalAmount - savingsBalance;

        // const getAmountUsed = (savings: number, amountToPay: number): number => {
        //   if (amountToPay > savings) {
        //     // If the amount to pay exceeds the savings, all savings are used.
        //     return savings - amountToPay;
        //   } else {
        //     // Otherwise, only the amount to pay is used.
        //     return amountToPay;
        //   }
        // };

        // console.log('deductedTotalAmount', deductedTotalAmount);
        // usedSavings = getAmountUsed(savingsBalance, deductedTotalAmount);
        // console.log('usedSavings', usedSavings);

        if (deductedTotalAmount <= 0 && savingsBalance > 0) {
          savingsRemainingBalance = Math.abs(deductedTotalAmount);
          deductedTotalAmount = 0;
        } else {
          /* do the deduction from redundant savings */
          // totalAmountOfSavings = totalAmountOfSavings - deductedTotalAmount; // deduct redundant savings
          // console.log('totalAmountOfSavings 3', totalAmountOfSavings, deductedTotalAmount);

          deductedTotalAmount = deductedTotalAmount - savingsRedundantBalance;

          // usedSavings += getAmountUsed(savingsRedundantBalance, deductedTotalAmount);
          // console.log('usedSavings 2', usedSavings);

          if (deductedTotalAmount <= 0) {
            savingsRedundantRemainingBalance = Math.abs(deductedTotalAmount);
            deductedTotalAmount = 0;
          } else {
            savingsRedundantRemainingBalance = 0;
          }
          savingsRemainingBalance = 0;
        }

        totalAmountOfSavings = amountToPay <= totalAmountOfSavings ? amountToPay : totalAmountOfSavings;

        // console.log('totalAmountOfSavings', totalAmountOfSavings);
      }

      /* savings - redundant */

      // if (deductedTotalAmount <= 0) {
      //   savingsRemainingBalance = Math.abs(deductedTotalAmount);
      //   deductedTotalAmount = 0;
      // } else {
      //   savingsRemainingBalance = 0;
      // }

      let fromDate = null;
      let toDate = null;

      if (!isEmpty(classDaysToPay)) {
        fromDate = `${classDaysToPay[0].month}/${classDaysToPay[0].day}/${classDaysToPay[0].year}`;
        const toDateLength = totalOfClassDaysToPay - 1;
        toDate = `${classDaysToPay[toDateLength].month}/${classDaysToPay[toDateLength].day}/${classDaysToPay[toDateLength].year}`;
      }

      /* get the days of last enrolled month if has a multiple months. */
      /* get the days of last enrolled month if user is click and disable the day in UI */
      /* sort and get the last element in the record. */
      // let lastDateEnrolled = null;
      // let lastEnrolledDaysMonth = [];
      // if (!isEmpty(studentsTuitionAttendance)) {
      //   lastDateEnrolled = last(sortBy(studentsTuitionAttendance.records, ['year', 'month', 'day']).filter((r) => r.paid));
      //   lastEnrolledDaysMonth = studentsTuitionAttendance.records.filter(
      //     (f) => f.month === lastDateEnrolled.month && f.year === lastDateEnrolled.year && ((!f.enable && !f.included) || (f.enable && f.included && !f.paid && f.status === 'off-day')),
      //   );
      // }

      const firstDateEnrolled: IStudentsTuitionAttendanceRecord = studentsTuitionAttendance
        ? first(sortBy(studentsTuitionAttendance.records, ['year', 'month', 'day']))
        : null;

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: {
          originalTotalAmount: round(originalTotalAmount),
          subTotalAmount: round(subTotalAmount),
          deductedTotalAmount: round(deductedTotalAmount),
          deductedTotalAmount2: round(deductedTotalAmount),
          totalOfClassDaysToPay: totalOfClassDaysToPay,
          subTotalAmountWithoutSavings: round(subTotalAmountWithoutSavings),

          savingsBalance: savingsBalance,
          savingsRemainingBalance: savingsRemainingBalance,

          savingsRedundantBalance: savingsRedundantBalance,
          savingsRedundantRemainingBalance: savingsRedundantRemainingBalance,

          usedSavings: round(totalAmountOfSavings),

          totalAddedDays: totalAddedDays,
          totalAmountOfAddedDays: round(totalAmountOfAddedDays),

          totalUnpaidDays: unpaidDaysInRecords.length,
          totalAmountOfUnpaidDays: round(totalAmountOfUnpaidDays),

          records: studentsTuitionAttendance ? sortBy(studentsTuitionAttendance.records, ['year', 'month', 'day']) : [],
          offDays: offDays,
          totalOfOffDays: totalOfOffDays,
          totalAmountOfOffDays: round(totalAmountOfOffDays),
          firstDateEnrolled: firstDateEnrolled,
          // lastDateEnrolled: lastDateEnrolled || null,
          // lastEnrolledDaysMonth: lastEnrolledDaysMonth,

          dates: body.dates,

          monthlyPrice: monthlyPrice,
          hourlyMonthlyPrice: hourlyMonthlyPrice,
          hourlyPackagePrice: hourlyPackagePrice,
          discount: discount,
          totalDiscount: totalDiscount,
          fromDate: fromDate,
          toDate: toDate,
          addition: body.addition,
          subtraction: body.subtraction,
          schedulesShift: schedulesShift,

          status: studentsTuitionAttendance?.status || null,
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

  public async tuitionStudents(query: TuitionStudentsInClassDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const month = parseInt(query.date.split('-')[0]);
      const year = parseInt(query.date.split('-')[1]);
      // const amount = parseInt(query.amount);

      // const associatedClass = await this.classes.aggregate([
      //   { $match: { _id: query.classId, deleted: false, properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId } },
      //   { $lookup: { from: 'courses', foreignField: '_id', localField: 'courses', as: 'courses' } },
      //   { $unwind: '$courses' },
      // ]);

      // const BASE_PRICE = (associatedClass[0] as Classes).courses.price;

      const page = typeof query.page === 'string' ? parseInt(query.page) : query.page;
      const limit = typeof query.limit === 'string' ? parseInt(query.limit) : query.limit;

      const aggregatedQuery: any = [
        {
          $match: {
            classes: query.classId,
            // status: 'ongoing',
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
            // status: 'ongoing',
            deleted: false,
          },
        },
        {
          $project: {
            _id: 1,
            student: 1,
            classes: 1,
            changeLogs: 1,
            debtRecords: {
              $filter: {
                input: '$records',
                as: 'record',
                cond: {
                  $and: [
                    {
                      $eq: ['$$record.paid', false],
                    },
                    { $eq: ['$$record.included', true] },
                    { $eq: ['$$record.enable', true] },
                  ],
                },
              },
            },

            records: {
              $filter: {
                input: '$records',
                as: 'record',
                cond: {
                  $and: [
                    {
                      $eq: ['$$record.month', month],
                    },
                    {
                      $eq: ['$$record.year', year],
                    },
                  ],
                },
              },
            },

            latestRecord: {
              $reduce: {
                input: '$records',
                initialValue: { day: 0, month: 0, year: 0 },
                in: {
                  $cond: {
                    if: {
                      $gt: ['$$this.year', '$$value.year'],
                    },
                    then: {
                      day: '$$this.day',
                      month: '$$this.month',
                      year: '$$this.year',
                    },
                    else: {
                      $cond: {
                        if: {
                          $and: [{ $eq: ['$$this.year', '$$value.year'] }, { $gt: ['$$this.month', '$$value.month'] }],
                        },
                        then: {
                          day: '$$this.day',
                          month: '$$this.month',
                          year: '$$this.year',
                        },
                        else: {
                          $cond: {
                            if: {
                              $and: [
                                { $eq: ['$$this.year', '$$value.year'] },
                                { $eq: ['$$this.month', '$$value.month'] },
                                { $gt: ['$$this.day', '$$value.day'] },
                              ],
                            },
                            then: {
                              day: '$$this.day',
                              month: '$$this.month',
                              year: '$$this.year',
                            },
                            else: '$$value',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            paymentHistory: 1,
            createdAt: 1,
            updatedAt: 1,
            status: 1,
          },
        },

        {
          $addFields: {
            records: {
              $map: {
                input: '$records',
                as: 'record',
                in: {
                  $mergeObjects: [
                    '$$record',
                    {
                      amount: '$$record.amount',
                      paidAmount: { $cond: [{ $eq: ['$$record.paid', true] }, '$$record.amount', 0] },
                      unPaid: { $cond: [{ $eq: ['$$record.paid', false] }, 1, 0] },
                      isAbsent: {
                        $cond: [
                          {
                            $eq: ['$$record.status', 'absent'],
                          },
                          1,
                          0,
                        ],
                      },
                      offDay: {
                        $cond: [
                          {
                            $eq: ['$$record.status', 'off-day'],
                          },
                          1,
                          0,
                        ],
                      },
                    },
                  ],
                },
              },
            },
            debtRecords: {
              $map: {
                input: '$debtRecords',
                as: 'record',
                in: {
                  $mergeObjects: [
                    '$$record',
                    {
                      date: {
                        $dateFromParts: {
                          year: '$$record.year',
                          month: '$$record.month',
                          day: '$$record.day',
                        },
                      },
                      amount: '$$record.amount',
                      paidAmount: {
                        $cond: [
                          {
                            $and: [{ $eq: ['$$record.paid', true] }],
                          },
                          '$$record.amount',
                          0,
                        ],
                      },
                      unPaid: { $cond: [{ $eq: ['$$record.paid', false] }, 1, 0] },
                      isAbsent: {
                        $cond: [
                          {
                            $eq: ['$$record.status', 'absent'],
                          },
                          1,
                          0,
                        ],
                      },
                      offDay: {
                        $cond: [
                          {
                            $eq: ['$$record.status', 'off-day'],
                          },
                          1,
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
            includedAndEnablePaidRecords: {
              $filter: {
                input: '$records',
                as: 'record',
                cond: {
                  $and: [{ $eq: ['$$record.included', true] }, { $eq: ['$$record.enable', true] }, { $eq: ['$$record.paid', true] }],
                },
              },
            },
            includedAndEnableUnPaidRecords: {
              $filter: {
                input: '$records',
                as: 'record',
                cond: {
                  $and: [
                    { $eq: ['$$record.included', true] },
                    { $eq: ['$$record.enable', true] },
                    { $eq: ['$$record.paid', false] },
                    { $ne: ['$$record.status', 'off-day'] },
                  ],
                },
              },
            },
          },
        },

        {
          $addFields: {
            // totalAmountPaid: {
            //   $reduce: {
            //     input: '$includedAndEnablePaidRecords',
            //     initialValue: 0,
            //     in: { $add: ['$$value', '$$this.paidAmount'] },
            //   },
            // },
            totalAmountNotPaid: {
              $reduce: {
                input: '$includedAndEnableUnPaidRecords',
                initialValue: 0,
                in: { $add: ['$$value', '$$this.amount'] },
              },
            },
            // totalOfUnpaidDays: {
            //   $sum: '$records.unPaid',
            // },
            totalOfOffDays: {
              $sum: '$records.offDay',
            },
            totalAmountCovered: {
              $sum: '$records.amount',
            },
            totalAbsent: {
              $sum: '$records.isAbsent',
            },
          },
        },

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

        /* add statusValue to sort the status=stopped */
        {
          $addFields: {
            statusValue: {
              $indexOfArray: [['stopped'], '$status'],
            },
          },
        },
        {
          $addFields: {
            status: '$status',
          },
        },
        // {
        //   $match: {
        //     totalAmountCovered: { $lte: amount },
        //     records: { $exists: true, $ne: [] },
        //   },
        // },

        // {
        //   $addFields: {
        //     totalAmountNotPaid: {
        //       $subtract: ['$totalAmountCovered', '$totalAmountUnPaid'],
        //     },
        //   },
        // },
        ...PaginationFieldsU(page, limit, 'statusValue', 1),
      ];

      // console.log('aggregatedQuery', JSON.stringify(aggregatedQuery));

      const studentsTuitionAttendances = await this.studentsTuitionAttendance.aggregate(aggregatedQuery);

      if (isEmpty(studentsTuitionAttendances[0]?.items)) {
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
        data: PaginationService(studentsTuitionAttendances[0]),
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

  public async attendanceStudents(query: AttendanceStudentsInClassDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      let classAssignedToTeacher = [];

      /* fetch assigned class to teacher */
      if (query.assignedToTeacher) {
        classAssignedToTeacher = await this.schedulesShifts.find({
          'staffs.id': tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        });
      }
      // console.log(
      //   classAssignedToTeacher.length,
      //   classAssignedToTeacher.filter((c) => c.classes).map((c) => c.classes),

      //   {
      //     ...(query.assignedToTeacher
      //       ? {
      //           classes: { $in: classAssignedToTeacher.filter((c) => c.classes).map((c) => c.classes) },
      //         }
      //       : {
      //           classes: query.classId,
      //         }),
      //   },
      // );

      const month = parseInt(query.date.split('-')[0]);
      const year = parseInt(query.date.split('-')[1]);

      const associatedClass = await this.classes.aggregate([
        { $match: { _id: query.classId, deleted: false, properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId } },
        { $lookup: { from: 'courses', foreignField: '_id', localField: 'courses', as: 'courses' } },
        { $unwind: '$courses' },
      ]);

      const BASE_PRICE = (associatedClass[0] as Classes).courses.price;

      const page = typeof query.page === 'string' ? parseInt(query.page) : query.page;
      const limit = typeof query.limit === 'string' ? parseInt(query.limit) : query.limit;

      const aggregatedQuery: any = [
        {
          $match: {
            ...(query.assignedToTeacher
              ? {
                  classes: { $in: classAssignedToTeacher.filter((c) => c.classes).map((c) => c.classes) },
                }
              : {
                  classes: query.classId,
                }),
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
            status: 'ongoing',
            deleted: false,
          },
        },
        {
          $project: {
            _id: 1,
            student: 1,
            classes: 1,
            records: {
              $filter: {
                input: '$records',
                as: 'record',
                cond: {
                  $and: [
                    {
                      $eq: ['$$record.month', month],
                    },
                    {
                      $eq: ['$$record.year', year],
                    },
                  ],
                },
              },
            },
            latestRecord: {
              $reduce: {
                input: '$records',
                initialValue: { day: 0, month: 0, year: 0 },
                in: {
                  $cond: {
                    if: {
                      $gt: ['$$this.year', '$$value.year'],
                    },
                    then: {
                      day: '$$this.day',
                      month: '$$this.month',
                      year: '$$this.year',
                    },
                    else: {
                      $cond: {
                        if: {
                          $and: [{ $eq: ['$$this.year', '$$value.year'] }, { $gt: ['$$this.month', '$$value.month'] }],
                        },
                        then: {
                          day: '$$this.day',
                          month: '$$this.month',
                          year: '$$this.year',
                        },
                        else: {
                          $cond: {
                            if: {
                              $and: [
                                { $eq: ['$$this.year', '$$value.year'] },
                                { $eq: ['$$this.month', '$$value.month'] },
                                { $gt: ['$$this.day', '$$value.day'] },
                              ],
                            },
                            then: {
                              day: '$$this.day',
                              month: '$$this.month',
                              year: '$$this.year',
                            },
                            else: '$$value',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            createdAt: 1,
            updatedAt: 1,
            status: 1,
          },
        },
        // {
        //   $addFields: {
        //     latestRecord: {
        //       $arrayElemAt: [
        //         {
        //           $filter: {
        //             input: '$records',
        //             as: 'record',
        //             cond: {
        //               $eq: ['$$record.day', '$latestRecordDate.day'],
        //               $eq: ['$$record.month', '$latestRecordDate.month'],
        //               $eq: ['$$record.year', '$latestRecordDate.year'],
        //             },
        //           },
        //         },
        //         0,
        //       ],
        //     },
        //   },
        // },
        {
          $addFields: {
            records: {
              $map: {
                input: '$records',
                as: 'record',
                in: {
                  $mergeObjects: [
                    '$$record',
                    {
                      amount: BASE_PRICE,
                      isAbsent: {
                        $cond: [
                          {
                            $eq: ['$$record.status', 'absent'],
                          },
                          1,
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
        // {
        //   $match: {
        //     totalAmountCovered: { $lte: amount },
        //     records: { $exists: true, $ne: [] },
        //   },
        // },

        {
          $addFields: {
            // discount: DISCOUNT,
            // discountedAmountCovered: {
            //   $multiply: ['$totalAmountCovered', { $subtract: [1, DISCOUNT] }],
            // },
            totalAmountNotPaid: {
              $subtract: ['$totalAmountCovered', '$totalAmountPaid'],
            },
          },
        },
        ...PaginationFieldsU(page, limit),
      ];

      const studentsTuitionAttendances = await this.studentsTuitionAttendance.aggregate(aggregatedQuery);

      if (isEmpty(studentsTuitionAttendances[0]?.items)) {
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
        data: PaginationService(studentsTuitionAttendances[0]),
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

  public async breakdown(query: BreakdownOfClassDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const aggregatedQuery: any = [
        {
          $match: {
            student: query.studentId,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
            // status: 'ongoing',
            deleted: false,
          },
        },
        {
          $project: {
            _id: 1,
            student: 1,
            classes: 1,
            status: 1,
            course: 1,
            records: 1,
            firstRecord: {
              $reduce: {
                input: '$records',
                initialValue: { day: 31, month: 12, year: 9999 },
                in: {
                  $cond: {
                    if: {
                      $lt: ['$$this.year', '$$value.year'],
                    },
                    then: {
                      day: '$$this.day',
                      month: '$$this.month',
                      year: '$$this.year',
                    },
                    else: {
                      $cond: {
                        if: {
                          $and: [{ $eq: ['$$this.year', '$$value.year'] }, { $lt: ['$$this.month', '$$value.month'] }],
                        },
                        then: {
                          day: '$$this.day',
                          month: '$$this.month',
                          year: '$$this.year',
                        },
                        else: {
                          $cond: {
                            if: {
                              $and: [
                                { $eq: ['$$this.year', '$$value.year'] },
                                { $eq: ['$$this.month', '$$value.month'] },
                                { $lt: ['$$this.day', '$$value.day'] },
                              ],
                            },
                            then: {
                              day: '$$this.day',
                              month: '$$this.month',
                              year: '$$this.year',
                            },
                            else: '$$value',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            latestRecord: {
              $reduce: {
                input: '$records',
                initialValue: { day: 0, month: 0, year: 0 },
                in: {
                  $cond: {
                    if: {
                      $gt: ['$$this.year', '$$value.year'],
                    },
                    then: {
                      day: '$$this.day',
                      month: '$$this.month',
                      year: '$$this.year',
                    },
                    else: {
                      $cond: {
                        if: {
                          $and: [{ $eq: ['$$this.year', '$$value.year'] }, { $gt: ['$$this.month', '$$value.month'] }],
                        },
                        then: {
                          day: '$$this.day',
                          month: '$$this.month',
                          year: '$$this.year',
                        },
                        else: {
                          $cond: {
                            if: {
                              $and: [
                                { $eq: ['$$this.year', '$$value.year'] },
                                { $eq: ['$$this.month', '$$value.month'] },
                                { $gt: ['$$this.day', '$$value.day'] },
                              ],
                            },
                            then: {
                              day: '$$this.day',
                              month: '$$this.month',
                              year: '$$this.year',
                            },
                            else: '$$value',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            debtRecords: {
              $filter: {
                input: '$records',
                as: 'record',
                cond: {
                  $and: [
                    {
                      $eq: ['$$record.paid', false],
                    },
                    { $eq: ['$$record.included', true] },
                    { $eq: ['$$record.enable', true] },
                  ],
                },
              },
            },
            createdAt: 1,
            updatedAt: 1,
          },
        },
        {
          $addFields: {
            records: {
              $map: {
                input: '$records',
                as: 'record',
                in: {
                  $mergeObjects: [
                    '$$record',
                    {
                      amount: '$$record.amount',
                      paidAmount: { $cond: [{ $eq: ['$$record.paid', true] }, '$$record.amount', 0] },
                      isAbsent: {
                        $cond: [
                          {
                            $eq: ['$$record.status', 'absent'],
                          },
                          1,
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
            totalAmountPaid: {
              $floor: {
                $round: [
                  {
                    $reduce: {
                      input: '$records',
                      initialValue: 0,
                      in: { $add: ['$$value', '$$this.paidAmount'] },
                    },
                  },
                  0,
                ],
              },
            },
            totalAmountCovered: {
              $sum: '$records.amount',
            },
            totalAbsent: {
              $sum: '$records.isAbsent',
            },
          },
        },

        /* Class */
        {
          $lookup: {
            from: 'classes',
            localField: 'classes',
            foreignField: '_id',
            as: 'class',
          },
        },
        {
          $unwind: '$class',
        },

        /* Course */
        {
          $lookup: {
            from: 'courses',
            localField: 'class.courses',
            foreignField: '_id',
            as: 'course',
          },
        },
        {
          $unwind: {
            path: '$course',
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $addFields: {
            totalAmountNotPaid: {
              $reduce: {
                input: '$records',
                initialValue: 0,
                in: {
                  $add: [
                    '$$value',
                    {
                      $cond: [
                        {
                          $and: [
                            {
                              $eq: ['$$this.paid', false],
                            },
                            {
                              $eq: ['$$this.included', true],
                            },
                            {
                              $eq: ['$$this.enable', true],
                            },
                          ],
                        },
                        '$$this.amount',
                        0,
                      ],
                    },
                  ],
                },
              },
            },
          },
        },

        {
          $sort: {
            // totalAmountCovered: -1,
            createdAt: -1,
          },
        },
      ];

      const studentsTuitionAttendances = await this.studentsTuitionAttendance.aggregate(aggregatedQuery);

      if (isEmpty(studentsTuitionAttendances)) {
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
        data: studentsTuitionAttendances,
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

  public async studentClassDebts(query: StudentClassDebtsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const studentsTuitionAttendances = await this.studentsTuitionAttendance.find(
        {
          student: query.studentId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          // status: 'ongoing',
          deleted: false,
          // 'records.paid': false,
          // 'records.enable': true,
          // 'records.included': true,
          records: {
            $elemMatch: {
              paid: false,
              enable: true,
              included: true,
            },
          },
        },
        { changeLogs: 0, paymentHistory: 0 }
      );

      if (isEmpty(studentsTuitionAttendances)) {
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
        data: studentsTuitionAttendances,
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

  public async fetchStudentClasses(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const studentsTuitionAttendance = await this.studentsTuitionAttendance.aggregate([
        {
          $match: {
            status: 'ongoing',
            student: tokenPayload.accountId,
            // properties: tokenPayload.propertyId,
          },
        },

        /* classes */
        {
          $lookup: {
            from: 'classes',
            localField: 'classes',
            foreignField: '_id',
            as: 'classes',
          },
        },
        {
          $unwind: {
            path: '$classes',
            preserveNullAndEmptyArrays: true,
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
        data: studentsTuitionAttendance,
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

  public async saveSavingsBreakdown(
    data: {
      // studentClassId: string;
      studentTuitionAttendanceId: string;
      studentId: string;
      attendanceInRecord: IStudentsTuitionAttendanceRecord;
      studentsTuitionAttendance: StudentsTuitionAttendance;
      type: 'off-day' | 'stop-learning';
    },
    tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    try {
      /* push the off-day */
      const studentsSavingsBreakdown = await this.studentsSavingsBreakdown.findOne({
        studentsTuitionAttendance: data.studentTuitionAttendanceId,
        student: data.studentId,
        status: 'ongoing',
        type: data.type,
      });

      if (isEmpty(studentsSavingsBreakdown)) {
        /* fetch class and course */
        const studentsTuitionAttendance = await this.studentsTuitionAttendance.findOne({
          _id: data.studentTuitionAttendanceId,
        });

        const classes = await this.classes.findOne({ _id: studentsTuitionAttendance.classes });
        const courses = await this.courses.findOne({ _id: classes.courses });

        this.studentsSavingsBreakdown
          .create({
            amount: data.attendanceInRecord.amount,
            amountDeducted: data.attendanceInRecord.amount,
            records: [data.attendanceInRecord],
            student: data.studentId,
            studentsTuitionAttendance: data.studentsTuitionAttendance._id,
            classes: {
              _id: classes._id,
              name: classes.name,
            },
            courses: {
              _id: courses._id,
              name: courses.name,
            },
            status: 'ongoing',
            type: data.type,
            properties: data.studentsTuitionAttendance.properties,
            propertiesBranches: data.studentsTuitionAttendance.propertiesBranches,
          })
          .then();
      } else {
        const isExist = studentsSavingsBreakdown.records.find(
          (r) => r.day === data.attendanceInRecord.day && r.month === data.attendanceInRecord.month && r.year === data.attendanceInRecord.year
        );
        if (isEmpty(isExist)) {
          this.studentsSavingsBreakdown
            .updateOne(
              {
                _id: studentsSavingsBreakdown._id,
                student: data.studentId,
                status: 'ongoing',
                // records: {
                //   $elemMatch: {
                //     month: record.month,
                //     day: record.day,
                //     year: record.year,
                //   },
                // },
                properties: tokenPayload.propertyId,
                propertiesBranches: tokenPayload.branchId,
              },
              {
                $inc: {
                  amount: data.attendanceInRecord.amount,
                  amountDeducted: data.attendanceInRecord.amount,
                },
                $push: {
                  records: {
                    $each: [data.attendanceInRecord],
                    $sort: { year: 1, month: 1, day: 1 },
                  },
                },
              }
            )
            .then();
        } else {
          console.log('savings record already exists');
        }
      }
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

  public async deductSavingsBreakdown(
    data: {
      savings: {
        savingsBalance: number;
        savingsRemainingBalance: number;
        savingsRedundantBalance: number;
        savingsRedundantRemainingBalance: number;
      };
      // studentClassId: string;
      studentId: string;
      // attendanceInRecord: IStudentsTuitionAttendanceRecord;
      // studentsTuitionAttendance: StudentsTuitionAttendance;
      // type: 'off-day' | 'stop-learning';
    },
    tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    try {
      const studentsSavingsBreakdown = await this.studentsSavingsBreakdown
        .find({
          student: data.studentId,
          status: 'ongoing',
        })
        .sort({ createdAt: 1 });

      /* deduct the off-day */
      const savingsBalance = data.savings.savingsBalance;
      const savingsRemainingBalance = data.savings.savingsRemainingBalance;
      const deductedSavingsBalance = savingsBalance - savingsRemainingBalance;
      // const offDays = studentsSavingsBreakdown.filter((s) => s.type === 'off-day');

      /* deduct the stop-learning */
      const savingsRedundantBalance = data.savings.savingsRedundantBalance;
      const savingsRedundantRemainingBalance = data.savings.savingsRedundantRemainingBalance;
      const deductedSavingsRedundantBalance = savingsRedundantBalance - savingsRedundantRemainingBalance;
      // const stopLearnings = studentsSavingsBreakdown.filter((s) => s.type === 'stop-learning');

      let amountToDeduct = deductedSavingsBalance + deductedSavingsRedundantBalance;

      for await (const savingsBreakdown of studentsSavingsBreakdown) {
        const totalDeducted = amountToDeduct;

        const remainingAmountOfSavingsBreakdown = savingsBreakdown.amountDeducted - amountToDeduct;

        /* may natitira pa sa savingsBreakdown.amount */
        if (remainingAmountOfSavingsBreakdown > 0) {
          await this.studentsSavingsBreakdown.updateOne(
            {
              _id: savingsBreakdown._id,
            },
            {
              $inc: { amountDeducted: -totalDeducted },

              /* if totalDeducted is below zero */
              ...(totalDeducted <= 0
                ? {
                    $set: {
                      status: 'completed',
                      amountDeducted: 0,
                    },
                  }
                : null),
            }
          );

          // amountToDeduct = totalDeducted;
          // stop next line kasi may natira pa sa savingsBreakdown.amount
          break;
        } else {
          /* convert negative to positive */
          amountToDeduct = Math.abs(remainingAmountOfSavingsBreakdown);

          /* update to completed */
          await this.studentsSavingsBreakdown.updateOne(
            { _id: savingsBreakdown._id },
            {
              $set: {
                status: 'completed',
                amountDeducted: 0,
              },
            }
          );
        }
      }
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

  public async refund(body: RefundClassDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      // const studentsSavingsBreakdown = await this.studentsSavingsBreakdown.find({
      //   student: body.studentId,
      //   status: 'ongoing',
      // });

      // console.log('studentsSavingsBreakdown', studentsSavingsBreakdown);

      const account = await this.accounts.findOne({ _id: body.studentId });

      let savingsRemainingBalance = account.saving - body.amount;
      let savingsRedundantRemainingBalance = account.redundantSaving; // - body.amount;

      /* savings */
      // deductedTotalAmount = deductedTotalAmount - savingsBalance;

      // let savingsRemainingBalance = 0;
      // let savingsRedundantRemainingBalance = 0;

      // console.log('deductedTotalAmount', deductedTotalAmount);

      if (savingsRemainingBalance < 0) {
        // savingsRemainingBalance = Math.abs(deductedTotalAmount);
        /* do the deduction from redundant savings */

        savingsRedundantRemainingBalance = account.redundantSaving - Math.abs(savingsRemainingBalance);

        if (savingsRedundantRemainingBalance <= 0) {
          savingsRedundantRemainingBalance = 0;
        }

        savingsRemainingBalance = 0;
      }

      /* deduct the savings breakdown */
      await this.deductSavingsBreakdown(
        {
          savings: {
            savingsBalance: account.saving,
            savingsRemainingBalance: savingsRemainingBalance,
            savingsRedundantBalance: account.redundantSaving,
            savingsRedundantRemainingBalance: savingsRedundantRemainingBalance,
          },
          // studentClassId: body.studentClassId,
          studentId: body.studentId,
        },
        tokenPayload
      );

      /* set savings */
      await this.accounts.findOneAndUpdate(
        { _id: body.studentId, properties: tokenPayload.propertyId },
        {
          $set: {
            saving: savingsRemainingBalance,
            redundantSaving: savingsRedundantRemainingBalance,
          },
        }
      );

      /* save expense */
      const cashflow = await this.cashflow.create({
        amount: body.amount,
        notes: `Refund of class tuition left`,
        receivedBy: body.studentId,
        payedBy: tokenPayload.accountId,
        mode: 'cash',
        type: 'expense',
        from: 'tuition-refund',
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        message: 'Refund was successfully deducted',
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

  public async fetchSavingsBreakdown(studentId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const studentsSavingsBreakdown = await this.studentsSavingsBreakdown
        .find({
          student: studentId,
          status: 'ongoing',
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        })
        .sort({ createdAt: -1 });

      if (isEmpty(studentsSavingsBreakdown)) {
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
        data: studentsSavingsBreakdown,
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

  public async fetchSavings(studentId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const account = await this.accounts.findOne(
        { _id: studentId },
        {
          _id: 1,
          saving: 1,
          redundantSaving: 1,
        }
      );

      if (isEmpty(account)) {
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
        data: account,
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

  public async fetchDraftTuitionStudents(query: FetchDraftTuitionDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const studentsTuitionAttendanceDrafts = await this.studentsTuitionAttendanceDraft.find({
        classes: query.classes,
        student: tokenPayload.accountId,
      });

      if (isEmpty(studentsTuitionAttendanceDrafts)) {
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
        data: studentsTuitionAttendanceDrafts,
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

  public async createDraftTuitionStudents(body: CreateDraftTuitionDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const studentsTuitionAttendanceDrafts = await this.studentsTuitionAttendanceDraft.create({
        name: body.name,
        classes: body.classes,
        student: tokenPayload.accountId,
        data: body.data,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      if (isEmpty(studentsTuitionAttendanceDrafts)) {
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
        data: studentsTuitionAttendanceDrafts,
        message: 'Draft tuition students created successfully',
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

  public async deleteDraftTuitionStudents(id: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.studentsTuitionAttendanceDraft.deleteOne({ _id: id });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Successfully deleted',
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
