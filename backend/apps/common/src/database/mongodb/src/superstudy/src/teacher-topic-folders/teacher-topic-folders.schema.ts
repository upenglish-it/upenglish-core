// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTTeacherTopicFoldersCN = 'sst-teacher-topic-folders';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: SSTTeacherTopicFoldersCN } })
export class SSTTeacherTopicFolders {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, required: true })
  public readonly description: string;

  @Prop({ type: String, required: true })
  public readonly icon: string;

  @Prop({ type: String, required: true })
  public readonly color: string;

  @Prop({ type: String, required: true })
  public readonly teacherId: string;

  @Prop({ type: [String], required: true })
  public readonly topicIds: string[];

  @Prop({ type: Boolean, default: false })
  public readonly appSystemFolder: boolean;

  @Prop({ type: Boolean, default: true })
  public readonly ownFolder: boolean;

  @Prop({ type: Date, default: null })
  public readonly deletedAt: Date;

  @Prop({ type: Boolean, default: false })
  public readonly isDeleted: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly isPublic?: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly public?: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly teacherVisible?: boolean;

  @Prop({ type: [String], default: [] })
  public readonly sharedWithTeacherIds?: string[];

  @Prop({ type: String, default: 'teacher' })
  public readonly createdByRole?: string;

  @Prop({ type: String, default: null })
  public readonly copiedFrom?: string;

  @Prop({ type: String, default: null })
  public readonly transferredFromOfficial?: string;

  @Prop({ type: Date, default: null })
  public readonly transferredAt?: Date;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ type: String, default: '' })
  public readonly createdByName?: string;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
