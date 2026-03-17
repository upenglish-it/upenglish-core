import { Prop, modelOptions } from '@typegoose/typegoose';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'organizations' } })
export class Organizations {
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
  // associated to parent collection
  // @Prop({ ref: () => Accounts, type: String, required: true })
  // public accounts: Accounts;

  // associated child collection
  // @Prop({
  //   ref: () => OrganizationsPlans,
  //   foreignField: 'organizations',
  //   localField: '_id',
  // })
  // public subOrganizations: Array<OrganizationsPlans>;

  // @Prop({
  //   ref: () => OrganizationsPlans,
  //   foreignField: 'organizations-plans',
  //   localField: '_id',
  // })
  // public organizationsPlans: Array<OrganizationsPlans>;
}
