// Schemas
import { Classes } from '../classes';
import { Accounts } from '../accounts';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
// import { ISchedulesTime, Schedules } from '.';
// Typegoose
import { Prop, modelOptions } from '@typegoose/typegoose';
// Utils
import { ISchedule, SYSTEM_ID } from 'apps/common/src/utils';
// Types
import { ScheduleTypeT } from '../../../../../../types/src/schedule.type';
// Constants
import { ScheduleTypeC } from '../../../../../../constants/src/schedule.constant';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'schedules-shifts' } })
export class SchedulesShifts {
  @Prop({ type: String, required: true })
  public title: string;

  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  // @Prop({ type: Array, required: true })
  // public members: Array<SchedulesShiftsMember>;

  // @Prop({ type: String, required: true })
  // public title: string;

  @Prop({ type: String, default: 'staff-work' })
  public type: TSchedulesType;

  @Prop({ type: Array, required: true, default: [] })
  public staffs: Array<SchedulesShiftsStaff>;

  // @Prop({ ref: () => Accounts, type: String, required: true })
  // public staff: Accounts;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public careTaker: Accounts;

  @Prop({ ref: () => Accounts, type: String, default: null })
  public homeworkChecker: Accounts;

  @Prop({ ref: () => Classes, type: String, default: null })
  public classes: Classes;

  @Prop({ type: String, required: true })
  public startDate: string;

  @Prop({ type: String })
  public room: string;

  @Prop({ type: Object, required: true })
  public time: ISchedulesTime;

  @Prop({ type: Array, default: [] })
  public notes: Array<{
    date: string;
    notes: string;
    accountId: string;
  }>;

  @Prop({ type: Array, default: [] })
  public lessonDetails: Array<{
    date: string;
    lessonDetails: string;
  }>;

  // @Prop({ ref: () => Schedules, type: String, required: true })
  // public schedules: Schedules;
  @Prop({ type: Object, required: true })
  public schedule: ISchedule;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;

  @Prop({ type: String, enum: ScheduleTypeC, required: true, default: ScheduleTypeC[0] })
  public status: ScheduleTypeT;
}

export interface SchedulesShiftsMember {
  accountId: string;
}

export type TSchedulesType = 'staff-work' | 'class-work' | 'tutoring-work' | 'tapa-work';

export interface SchedulesShiftsStaff {
  id: string;
  schedule: Array<string>; // FROM and TO date
  substituteSchedule: Array<{
    staffId: string;
  }>;
}

export interface ISchedulesTime {
  from: string;
  to: string;
}
