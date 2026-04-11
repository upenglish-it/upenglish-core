import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
import { Courses } from '.';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: 'courses-groups' } })
export class CoursesGroups {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: String, required: true })
  public name: string;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;

  // // associated to parent collection
  @Prop({ ref: () => Array<Courses>, type: Array, default: [] })
  public courses: Array<Courses>;

  // /* associated child collection */
  // @Prop({
  //   ref: () => Accounts,
  //   foreignField: '_id',
  //   localField: 'members',
  //   required: false,
  // })
  // public members: Array<Accounts>;
}
