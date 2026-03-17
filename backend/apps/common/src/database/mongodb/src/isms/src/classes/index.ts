import { Prop, modelOptions } from '@typegoose/typegoose';
import { Courses } from '../courses';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { StudentsTuitionAttendance } from '../students/tuition-attendance.schema';
// import { ClassesDay } from './classes-day.schema';
// import { ClassesTime } from './classes-time.schema';
// import { Accounts } from '../accounts';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'classes' } })
export class Classes {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: String, required: false, default: null })
  public name: string;

  // @Prop({ type: String, default: null })
  // public startDate: string;

  // @Prop({ type: String, default: null })
  // public endDate: string;

  @Prop({ type: String, required: true, default: 'monthly-rate' })
  public typeOfRate: 'monthly-rate' | 'hourly-rate';

  @Prop({ type: String, required: true, default: 'not-started' })
  public status: TClasses;

  @Prop({ ref: () => Courses, type: String, required: false }) // due to migration, this is not required
  public courses: Courses;

  // @Prop({ ref: () => ClassesDay, type: String, required: true })
  // public classesDay: ClassesDay;

  // @Prop({ ref: () => ClassesTime, type: String, required: true })
  // public classesTime: ClassesTime;

  // @Prop({ ref: () => Accounts, type: String, required: true })
  // public teacher: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  /* associated child collection */
  @Prop({
    ref: () => StudentsTuitionAttendance,
    foreignField: 'classes',
    localField: '_id',
    justOne: true,
  })
  public tuitionAttendances: Array<StudentsTuitionAttendance>;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}

export type TClasses = 'not-started' | 'ongoing' | 'finished';
