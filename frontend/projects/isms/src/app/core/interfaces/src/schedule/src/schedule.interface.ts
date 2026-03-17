import { IAccount } from "../../account/account.interface";
import { IClass } from "../../classes";

// export interface IStaffSchedule {
//   _id: string;
//   title: string;
//   time: IScheduleTime;
//   schedule: ISchedule;
//   order: number;
//   createdBy: string;
//   properties: string;
//   propertiesBranches: string;
//   deleted: boolean;
//   createdAt: string;
//   updatedAt: string;
//   schedulesShifts: Array<IScheduleSchedulesShift>;

//   // Added in FE
//   timeRangeText?: string;
// }

export interface IScheduleSchedulesShift {
  _id: string;
  title: string;
  type: "staff-work" | "class-work" | "tutoring-work" | "tapa-work";
  startDate: string;
  time: IScheduleTime;
  staff: IAccount;
  careTaker: IAccount;
  classes: IClass;
  room: string;
  notes: Array<IScheduleSchedulesShiftNote>;
  lessonDetails: Array<IScheduleSchedulesShiftLessonDetails>;
  createdBy: string;
  schedule: ISchedule;
  properties: string;
  propertiesBranches: string;
  deleted: false;
  createdAt: string;
  updatedAt: string;

  // Added in FE
  timeRangeText?: string;
}

export interface IScheduleSchedulesShiftNote {
  date: string;
  notes: string;
  accountId: string;
  fullName: string;
}

export interface IScheduleSchedulesShiftLessonDetails {
  date: string;
  lessonDetails: string;
}

export interface ISchedule {
  fromDate: Date;
  fromTime: Date;
  fromTimezone: string;
  toDate: Date;
  toTime: Date;
  toTimezone: string;
  allDay: boolean;
  recurrence: {
    enable: string;
    value: string;
    freq: number;
    interval: number;
    byweekday: Array<number>;
    bymonth: Array<number>;
    ends: {
      type: "never" | "on" | "after";
      endDate: string;
      count: number;
    };
  };
}

export interface IScheduleTime {
  from: string;
  to: string;
}
