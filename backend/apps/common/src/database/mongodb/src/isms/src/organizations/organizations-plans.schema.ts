import { Prop, modelOptions } from '@typegoose/typegoose';
import { Organizations } from '.';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'organizations-plans' } })
export class OrganizationsPlans {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: String, required: true })
  public name: string;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;

  // associated to parent collection
  @Prop({ ref: () => Organizations, type: String, required: true })
  public organizations: Organizations;
}
