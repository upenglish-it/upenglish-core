// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTUserGroupsCN = 'sst-user-groups';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTUserGroupsCN } })
export class SSTUserGroups {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, required: true })
  public readonly description: string;

  @Prop({ type: String, required: true })
  public readonly folderAccess: string;

  @Prop({ type: Boolean, required: true })
  public readonly hidden: boolean;

  @Prop({ type: Boolean, required: true })
  public readonly enableRewardPoints: boolean;

  @Prop({ type: Array, required: true })
  public readonly topicAccess: string[];

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
