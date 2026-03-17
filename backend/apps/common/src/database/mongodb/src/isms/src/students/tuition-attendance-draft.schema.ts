import { Prop, modelOptions } from '@typegoose/typegoose';
import { Accounts } from '../accounts';
import { Classes } from '../classes';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';
@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'students-tuition-attendance-draft' } })
export class StudentsTuitionAttendanceDraft {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: String, required: true })
  public name: string;

  @Prop({ type: Object, required: true })
  public data: any;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public student: Accounts;

  @Prop({ ref: () => Classes, type: String, required: true })
  public classes: Classes;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}
