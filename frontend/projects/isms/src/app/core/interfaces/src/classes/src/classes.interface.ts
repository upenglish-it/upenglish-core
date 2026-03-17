import { IPricing } from "@isms-core/components/students/enroll-new-student-modal/enroll-new-student-modal.component";
import { IAccount } from "../../account/account.interface";
import { ICourse } from "../../courses";
import { IScheduleSchedulesShift } from "../../schedule";
export interface IClass {
  _id: string;
  name: string;
  status: ClassStatus;
  courses: ICourse;
  schedulesShift: IScheduleSchedulesShift | null;
  properties: string;
  propertiesBranches: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;

  totalMembers?: number; // used in task
  studentsTuitionAttendance?: Array<IClassStudent>; // used in task
}

export interface IClassStudent {
  _id: string;
  student: string;
  classes: any; // it can be string | IClass;
  status: ClassStatus;
  course: ICourse;
  createdAt: string;
  updatedAt: string;
  records: Array<IClassStudentRecord>;
  debtRecords: Array<IClassStudentRecord>;
  totalAmountCovered: number;
  totalAbsent: number;
  account: IAccount;
  discount: number;
  discountedAmountCovered: number;
  firstRecord: {
    day: number;
    month: number;
    year: number;
  };
  latestRecord: {
    day: number;
    month: number;
    year: number;
  };
  paymentHistory: Array<IClassPaymentHistory>;
  changeLogs: Array<IClassChangeLog>;
  totalOfOffDays?: number;
  totalAmountNotPaid?: number;

  // added from `breakdown` api
  class?: IClass;

  // added in FE
  totalAmountPaid: number;
  selected?: boolean;

  // added in FE tuition payment listing
  totalDebtAmount?: number;
  totalOfUnpaidDays?: number;
  monthHasUnPaid?: boolean;

  studentInfo?: IAccount; // used in task
}

export interface IClassStudentRecord {
  id: string;
  createdAt?: string;
  date?: string;
  day: number;
  month: number;
  year: number;
  amount?: number;
  paid: boolean; // identifier if the student is paid this day.
  note?: string; // use for attendance
  hour: string; // use for attendance
  minute: string; // use for attendance
  status: "present" | "off-day" | "absent-with-notice" | "absent"; // use for attendance
  reason: string; // use for absent-with-notice and off-day
  paymentHistoryId: string;
  paymentType: "monthly" | "package" | "hourly-monthly" | "hourly-package";
  isAbsent?: number;
  included: boolean;
  enable: boolean;
  paidOffDay: boolean;
  stoppedLearning: boolean;
  // use for FE total debt per month
  totalAmount?: number;
  past1Week?: boolean;
}

export interface IClassPaymentHistory {
  createdAt: string;
  data: IPricing;
  // {
  //   originalTotalAmount: number;
  //   deductedTotalAmount: number;
  //   totalOfClassDaysToPay: number;
  //   savingsBalance: number;
  //   totalAddedDays: number;
  //   totalAmountOfAddedDays: number;
  //   totalUnpaidDays: number;
  //   totalAmountOfUnpaidDays: number;
  //   basePrice: number;
  //   discount: number;
  //   totalDiscount: number;
  //   fromDate: string;
  //   toDate: string;
  //   addition: number;
  //   subtraction: number;
  // };
  id: string;
  performedBy: string;
  transactionId: string;
  urlCode: string;
}

export interface IClassChangeLog {
  id: string;
  actionType: "pay-tuition";
  data: IClassStudent;
  dateCreated: string;
}

export type ClassStatus = "not-started" | "ongoing" | "stopped" | "finished" | "completed" | "stopped-reuse";
