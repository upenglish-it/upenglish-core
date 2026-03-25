export const TopicStatusC = ['draft', 'published', 'archived'] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTTopicsCN = 'sst-topics';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTTopicsCN } })
export class SSTTopics {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, default: null })
  public readonly color: string;

  @Prop({ type: String, default: null })
  public readonly icon: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, default: null })
  public readonly description: string;

  @Prop({ type: String, enum: TopicStatusC, default: 'draft' })
  public readonly status: TopicStatusT;

  @Prop({ type: Number, default: 0 })
  public readonly cachedWordCount: number;

  @Prop({ type: Boolean, default: false })
  public readonly inPublicFolder: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly isPublic: boolean;

  /** Teachers can view/assign but not students */
  @Prop({ type: Boolean, default: false })
  public readonly teacherVisible: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly isDeleted: boolean;

  @Prop({ type: Date, default: null })
  public readonly deletedAt: Date;

  /** Folder this topic belongs to */
  @Prop({ type: String, default: null })
  public readonly folderId: string;

  /** Teacher IDs that have been individually shared this topic */
  @Prop({ type: Array, default: [] })
  public readonly sharedWithTeacherIds: string[];

  /** 'admin' | 'teacher' */
  @Prop({ type: String, default: 'admin' })
  public readonly createdByRole: string;

  @Prop({ type: String, default: null })
  public readonly createdByName: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

export type TopicStatusT = (typeof TopicStatusC)[number];
