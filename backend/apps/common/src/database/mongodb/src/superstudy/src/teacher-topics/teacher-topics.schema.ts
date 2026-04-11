// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTTeacherTopicsCN = 'sst-teacher-topics';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: SSTTeacherTopicsCN } })
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

  @Prop({ type: Array, default: [] })
  public readonly words: Record<string, any>[];

  @Prop({ type: Boolean, default: false })
  public readonly isDeleted: boolean;

  @Prop({ type: Date, default: null })
  public readonly deletedAt: Date;

  @Prop({ type: String, default: null })
  public readonly duplicatedFrom: string;

  @Prop({ type: [String], default: [] })
  public readonly collaborators: string[];

  @Prop({ type: [String], default: [] })
  public readonly collaboratorNames: string[];

  @Prop({ type: [String], default: [] })
  public readonly collaboratorIds: string[];

  @Prop({ type: [String], default: [] })
  public readonly collaboratorRoles: string[];

  @Prop({ type: Boolean, default: false })
  public readonly isPublic: boolean;

  @Prop({ type: String, default: 'teacher' })
  public readonly createdByRole?: string;

  @Prop({ type: String, default: null })
  public readonly transferredFromOfficial?: string;

  @Prop({ type: Date, default: null })
  public readonly transferredAt?: Date;

  /** Folder this teacher topic belongs to */
  @Prop({ type: String, default: null })
  public readonly folderId: string;

  @Prop({ ref: () => Accounts, type: String, required: false })
  public readonly createdBy?: Accounts;

  @Prop({ type: String, default: '' })
  public readonly createdByName?: string;

  @Prop({ ref: () => Properties, type: String, required: false })
  public readonly properties?: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: false })
  public readonly propertiesBranches?: PropertiesBranches;
}
