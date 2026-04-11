// import { Prop, modelOptions, Ref, Severity } from '@typegoose/typegoose';
// import { Accounts } from '../accounts';
// import { Cashflow } from '../cashflow';
// import { Classes } from '../classes';
// import { Properties } from '../properties';
// import { PropertiesBranches } from '../properties/branches';

// @modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: 'students-tuition-attendance' } })
// export class StudentsTuitionAttendance {
//   @Prop({
//     type: String,
//     default: () => SYSTEM_ID(),
//   })
//   public _id: string;

//   // @Prop({ type: Object, required: true })
//   // public tuition: IStudentsTuitionAttendanceTuition;

//   // @Prop({ type: Array, required: true })
//   // public attendances: Array<IStudentsTuitionAttendanceAttendance>;

//   /**
//    * @records is the identifier of payment the history wether student paid monthly to track the next month if student didn't pay
//    */
//   @Prop({ type: Array, required: false, default: [] })
//   public records: Array<IStudentsTuitionAttendanceRecord>;

//   // @Prop({ type: Array, required: true })
//   // public changeLogs: Array<IStudentsTuitionAttendanceChangeLog>;

//   @Prop({ ref: () => Accounts, type: String, required: true })
//   public student: Accounts;

//   /**
//    * @teacher it can be a teacher/professor
//    *  */
//   @Prop({ ref: () => Accounts, type: String, required: true })
//   public teacher: Accounts;

//   /**
//    * @enrolledBy a person who added the student to the class
//    *  */
//   @Prop({ ref: () => Accounts, type: String, required: false })
//   public enrolledBy: Accounts;

//   @Prop({ ref: () => Classes, type: String, required: true })
//   public classes: Classes;

//   @Prop({ type: String, required: true, default: 'ongoing' })
//   public status: TStudentsTuitionAttendanceStatus;

//   @Prop({ type: Boolean, default: false })
//   public isPaidInPackage: boolean;

//   /* associated child collection */
//   // @Prop({
//   //   ref: () => Cashflow,
//   //   foreignField: 'tuition.tuitionAttendance',
//   //   localField: '_id',
//   // })
//   // public cashflow: Array<Cashflow>;

//   @Prop({ ref: () => Properties, type: String, required: true })
//   public properties: Properties;

//   @Prop({ ref: () => PropertiesBranches, type: String, required: true })
//   public propertiesBranches: PropertiesBranches;

//   @Prop({ type: Boolean, required: false, default: false })
//   public deleted: boolean;
// }

// export interface IStudentsTuitionAttendanceRecord {
//   month: number;
//   year: number;
//   createdAt: string;
//   paid: boolean; // TStudentsTuitionAttendanceRecordFullPaymentStatus; // identifier that student is pay that month
//   tuition: IStudentsTuitionAttendanceRecordTuition;
//   attendances: Array<IStudentsTuitionAttendanceRecordAttendance>;
//   changeLogs: Array<IStudentsTuitionAttendanceRecordChangeLog>;
//   paymentHistory: Array<{ amount: number; createdAt: string }>;
// }

// type TStudentsTuitionAttendanceRecordFullPaymentStatus = 'paid' | 'unpaid';

// interface IStudentsTuitionAttendanceRecordTuition {
//   individualTuition: number;
//   discount: number;
//   packageCover: number;
//   lastMonthDebt: number;
//   lastMonthOffDay: number;
//   otherDeduction: {
//     addition: number;
//     deduction: number;
//     note: string;
//   };
//   status: TStudentsTuitionAttendanceRecordTuitionStatus;
// }

// export type TStudentsTuitionAttendanceRecordTuitionStatus =
//   | 'paid-monthly'
//   | 'paid-package'
//   | 'stop-learning'
//   | 'cant-pay-this-month'
//   | 'cant-pay-tuition';

// export interface IStudentsTuitionAttendanceRecordAttendance {
//   day: number;
//   hour: number;
//   minute: number;
//   note: string;
//   status: TStudentsTuitionAttendanceRecordAttendanceStatus;
//   paid: boolean;
//   createdAt: string;
// }

// export type TStudentsTuitionAttendanceRecordAttendanceStatus = 'present' | 'off-day' | 'absent-with-notice' | 'absent';

// interface IStudentsTuitionAttendanceRecordChangeLog {
//   data: IStudentsTuitionAttendanceRecord;
//   createdAt: string;
// }

// type TStudentsTuitionAttendanceStatus = 'ongoing' | 'stop-learning' | 'completed';

import { Prop, modelOptions, Ref, Severity } from '@typegoose/typegoose';
import { Accounts } from '../accounts';
import { Cashflow } from '../cashflow';
import { Classes } from '../classes';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { DateTime } from 'luxon';
import { SchedulesShifts } from '../schedules/shifts.schema';

export const StudentsTuitionAttendanceCN = 'students-tuition-attendance';
@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: StudentsTuitionAttendanceCN } })
export class StudentsTuitionAttendance {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  // @Prop({ type: Object, required: true })
  // public tuition: IStudentsTuitionAttendanceTuition;

  // @Prop({ type: Array, required: true })
  // public attendances: Array<IStudentsTuitionAttendanceAttendance>;

  /**
   * @records is the identifier of payment the history wether student paid monthly to track the next month if student didn't pay
   */
  @Prop({ type: Array, required: false, default: [] })
  public records: Array<IStudentsTuitionAttendanceRecord>;

  @Prop({ type: Array, default: [] })
  public changeLogs: Array<{
    id: string;
    actionType: 'pay-tuition' | 'enroll-student';
    dateCreated: string;
    data: StudentsTuitionAttendance;
  }>;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public student: Accounts;

  @Prop({ ref: () => SchedulesShifts, type: String, required: true })
  public schedulesShift: SchedulesShifts;

  @Prop({ type: Array, required: false, default: [] })
  public paymentHistory: Array<IStudentsTuitionAttendancePaymentHistory>;

  // /**
  //  * @teacher it can be a teacher/professor
  //  *  */
  // @Prop({ ref: () => Accounts, type: String, required: true })
  // public teacher: Accounts;

  /**
   * @enrolledBy a person who added the student to the class
   *  */
  @Prop({ ref: () => Accounts, type: String, required: false })
  public enrolledBy: Accounts;

  @Prop({ ref: () => Classes, type: String, required: true })
  public classes: Classes;

  @Prop({ type: String, default: 'ongoing' })
  public status: TStudentsTuitionAttendanceStatus;

  @Prop({ type: String, default: null })
  public reason: TStudentsTuitionAttendanceReason; // reason of stopping the class

  // @Prop({ type: Boolean, default: false })
  // public isPaidInPackage: boolean;

  /* associated child collection */
  // @Prop({
  //   ref: () => Cashflow,
  //   foreignField: 'tuition.tuitionAttendance',
  //   localField: '_id',
  // })
  // public cashflow: Array<Cashflow>;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}

export interface IStudentsTuitionAttendanceRecord {
  createdAt: string;
  // paid: boolean; // TStudentsTuitionAttendanceRecordFullPaymentStatus; // identifier that student is pay that month
  // tuition: IStudentsTuitionAttendanceRecordTuition;
  // attendances: Array<IStudentsTuitionAttendanceRecordAttendance>;
  // changeLogs: Array<IStudentsTuitionAttendanceRecordChangeLog>;
  // paymentHistory: Array<{ amount: number; createdAt: string }>;

  //////////// new
  // billingCycleCompleted: boolean;
  paymentType: 'monthly' | 'package' | 'hourly-monthly' | 'hourly-package';
  paidOffDay: boolean;
  // hour: number;
  // minute: number;
  // note: string;
  // status: TStudentsTuitionAttendanceRecordAttendanceStatus;
  savingsConsumed: boolean;
  paymentHistoryId: string;

  // as of aug 11, 2023
  included: boolean;
  enable: boolean;
  stoppedLearning: boolean;
  id: string;
  completed: boolean;
  amount: number;
  day: number;
  month: number;
  year: number;
  date?: DateTime; // used in off-day extend
  paid: boolean; // identifier if the student is paid this day.
  notes: string; // use for attendance
  hour: number; // use for attendance
  minute: number; // use for attendance
  status: 'present' | 'off-day' | 'absent-with-notice' | 'absent'; // use for attendance
  void: boolean; // if true dont include in the calculation
}

type TStudentsTuitionAttendanceRecordFullPaymentStatus = 'paid' | 'unpaid';

// interface IStudentsTuitionAttendanceRecordTuition {
//   individualTuition: number;
//   discount: number;
//   packageCover: number;
//   lastMonthDebt: number;
//   lastMonthOffDay: number;
//   otherDeduction: {
//     addition: number;
//     deduction: number;
//     note: string;
//   };
//   status: TAttendanceStatus;
// }

// export type TAttendanceStatus = 'paid-monthly' | 'paid-package' | 'stop-learning' | 'cant-pay-this-month' | 'cant-pay-tuition';

export interface IStudentsTuitionAttendanceRecordAttendance {
  day: number;
  hour: number;
  minute: number;
  note: string;
  status: TStudentsTuitionAttendanceRecordAttendanceStatus;
  paid: boolean;
  createdAt: string;
}

export interface IStudentsTuitionAttendancePaymentHistory {
  id: string;
  urlCode: string;
  transactionId: string;
  performedBy: string;
  data: IStudentsTuitionAttendancePaymentHistoryData;
  createdAt: string;
}

export interface IStudentsTuitionAttendancePaymentHistoryData {
  amountPaid: string;
  classDate: string;
}

export type TStudentsTuitionAttendanceRecordAttendanceStatus = 'present' | 'off-day' | 'absent-with-notice' | 'absent';

// interface IStudentsTuitionAttendanceRecordChangeLog {
//   data: IStudentsTuitionAttendanceRecord;
//   createdAt: string;
// }

type TStudentsTuitionAttendanceStatus = 'ongoing' | 'stopped' | 'completed' | 'stopped-reuse';
export type TStudentsTuitionAttendanceReason = 'cant-pay' | 'leave-without-notice';
