import { Prop, modelOptions } from '@typegoose/typegoose';
import { Accounts } from '.';
import { Properties } from '../properties';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'accounts-properties' } })
export class AccountsProperties {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  _id: string;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;

  /* associated to parent collection */
  @Prop({ ref: () => Accounts, type: String, required: true })
  public accounts: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  // @Prop({ ref: () => RolesPermissions, type: String, required: true })
  // public rolesPermissions: RolesPermissions;
}
