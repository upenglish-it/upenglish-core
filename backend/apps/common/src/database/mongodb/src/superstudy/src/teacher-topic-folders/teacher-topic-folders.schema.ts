// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTTeacherTopicFoldersCN = 'sst-teacher-topic-folders';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTTeacherTopicFoldersCN } })
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

  @Prop({ type: Array, required: true })
  public readonly topicIds: string[];

  @Prop({ type: Boolean, default: false })
  public readonly appSystemFolder: boolean;

  @Prop({ type: Boolean, default: true })
  public readonly ownFolder: boolean;

  @Prop({ type: Date, default: null })
  public readonly deletedAt: Date;

  @Prop({ type: Boolean, default: false })
  public readonly isDeleted: boolean;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
