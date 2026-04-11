import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
import { Accounts } from '../accounts';
import { Classes } from '../classes';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { IStudentsTuitionAttendanceRecord, StudentsTuitionAttendance } from './tuition-attendance.schema';
import { Courses } from '../courses';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: 'students-savings-breakdown' } })
export class StudentsSavingsBreakdown {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  @Prop({ type: Number, required: true, default: 0 })
  public amount: number;

  @Prop({ type: Number, required: true, default: 0 })
  public amountDeducted: number;

  @Prop({ type: Array, required: false, default: [] })
  public records: Array<IStudentsTuitionAttendanceRecord>;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public student: Accounts;

  @Prop({ ref: () => StudentsTuitionAttendance, type: String, required: true })
  public studentsTuitionAttendance: StudentsTuitionAttendance;

  @Prop({ type: Object, required: true })
  public classes: Classes;

  @Prop({ type: Object, required: true })
  public courses: Courses;

  @Prop({ type: String, required: true })
  public type: 'off-day' | 'stop-learning';

  @Prop({ type: String, default: 'ongoing' })
  public status: 'ongoing' | 'completed';

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}
