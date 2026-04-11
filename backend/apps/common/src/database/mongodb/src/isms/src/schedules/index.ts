// import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// import { Properties } from '../properties';
// import { PropertiesBranches } from '../properties/branches';
// import { SYSTEM_ID } from 'apps/common/src/utils';
// import { Accounts } from '../accounts';
// import { IEventSchedule } from '../integrations/calendars/calendars-events.schema';
// import { SchedulesShifts } from './shifts.schema';

// @modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: 'schedules' } })
// export class Schedules {
//   @Prop({ type: String, default: () => SYSTEM_ID() })
//   public _id: string;

//   @Prop({ type: String, required: true })
//   public title: string;

//   @Prop({ type: Object, required: true })
//   public time: ISchedulesTime;

//   @Prop({ type: Object, required: true })
//   public schedule: IEventSchedule;

//   @Prop({ type: Number, required: true })
//   public order: number;

//   @Prop({ ref: () => Accounts, type: String, required: true })
//   public createdBy: Accounts;

//   @Prop({ ref: () => Properties, type: String, required: true })
//   public properties: Properties;

//   @Prop({ ref: () => PropertiesBranches, type: String, required: true })
//   public propertiesBranches: PropertiesBranches;

//   @Prop({ type: Boolean, required: false, default: false })
//   public deleted: boolean;
// }
// export interface ISchedulesTime {
//   from: string;
//   to: string;
// }
