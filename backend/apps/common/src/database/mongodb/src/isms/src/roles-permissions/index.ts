import { Prop, modelOptions } from '@typegoose/typegoose';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'roles-permissions' } })
export class RolesPermissions {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  _id: string;

  @Prop({ type: String, required: true })
  name: string;

  /**
   * @value it only applies to all predefined roles*/
  @Prop({ type: String, required: true })
  // value: TAccountsRole;
  value: any;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Array, required: true })
  permissions: Array<IPermission>;
}

export interface IPermission {
  name: string;
  value: string;
  url?: string;
  pageAccess?: boolean;
  view?: boolean;
  edit?: boolean;
  create?: boolean;
  delete?: boolean;
  permissions?: Array<IPermission>;
}
