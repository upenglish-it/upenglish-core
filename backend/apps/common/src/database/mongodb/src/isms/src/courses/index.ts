import { Prop, modelOptions } from '@typegoose/typegoose';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { Materials } from '../materials';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'courses' } })
export class Courses {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: String, required: true })
  public name: string;

  @Prop({ type: Number, required: true })
  public price: number;

  @Prop({ type: Number, required: true })
  public hourlyMonthlyPrice: number;

  @Prop({ type: Number, required: true })
  public hourlyPackagePrice: number;

  @Prop({ ref: () => Materials, type: String, default: null })
  public material: Materials;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: false })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}
