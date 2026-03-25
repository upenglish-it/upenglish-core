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

  @Prop({ type: String, default: null })
  public readonly description: string;

  @Prop({ type: String, default: null })
  public readonly folderAccess: string;

  /** Hidden groups are not displayed in teacher/student group lists */
  @Prop({ type: Boolean, default: false })
  public readonly hidden: boolean;

  /** Also stored as isHidden in original Firestore — keep both for compatibility */
  @Prop({ type: Boolean, default: false })
  public readonly isHidden: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly enableRewardPoints: boolean;

  /** Topic IDs that students in this group have access to */
  @Prop({ type: Array, default: [] })
  public readonly topicAccess: string[];

  /** Grammar exercise IDs that students in this group have access to */
  @Prop({ type: Array, default: [] })
  public readonly grammarAccess: string[];

  /** Exam IDs that students in this group have access to */
  @Prop({ type: Array, default: [] })
  public readonly examAccess: string[];

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
