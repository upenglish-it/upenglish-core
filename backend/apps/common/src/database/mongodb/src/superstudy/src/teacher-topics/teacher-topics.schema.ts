// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTTeacherTopicsCN = 'sst-teacher-topics';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTTeacherTopicsCN } })
export class SSTTeacherTopics {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly teacherId: string;

  @Prop({ type: String, default: null })
  public readonly color: string;

  @Prop({ type: String, default: null })
  public readonly icon: string;

  @Prop({ type: String, default: null })
  public readonly description: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: Boolean, default: false })
  public readonly owner: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly admin: boolean;

  @Prop({ type: Number, default: 0 })
  public readonly cachedWordCount: number;

  @Prop({ type: Boolean, default: false })
  public readonly isDeleted: boolean;

  @Prop({ type: Date, default: null })
  public readonly deletedAt: Date;

  @Prop({ type: String, default: null })
  public readonly duplicatedFrom: string;

  @Prop({ type: Array, default: [] })
  public readonly collaborators: string[];

  @Prop({ type: Array, default: [] })
  public readonly collaboratorNames: string[];

  @Prop({ type: Array, default: [] })
  public readonly collaboratorIds: string[];

  @Prop({ type: Array, default: [] })
  public readonly collaboratorRoles: string[];

  @Prop({ type: Boolean, default: false })
  public readonly isPublic: boolean;

  /** Folder this teacher topic belongs to */
  @Prop({ type: String, default: null })
  public readonly folderId: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
