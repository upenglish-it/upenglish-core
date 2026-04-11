// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTTopicFoldersCN = 'sst-topic-folders';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTTopicFoldersCN } })
export class SSTTopicFolders {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly color: string;

  @Prop({ type: String, required: true })
  public readonly icon: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, required: true })
  public readonly description: string;

  @Prop({ type: Number, required: true })
  public readonly order: number;

  @Prop({ type: [String], required: true })
  public readonly topicIds: string[];

  @Prop({ type: Boolean, required: true })
  public readonly teacherVisible: boolean;

  @Prop({ type: [String], required: true })
  public readonly sharedWithTeacherIds: string[];

  @Prop({ type: String, default: null })
  public readonly copiedFrom?: string;

  @Prop({ type: String, default: null })
  public readonly proposedBy?: string;

  @Prop({ type: String, default: null })
  public readonly proposedByName?: string;

  @Prop({ type: Boolean, default: false })
  public readonly isPublic: boolean;

  // Legacy Firestore compatibility for older folder documents.
  @Prop({ type: Boolean, required: true })
  public readonly public: boolean;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
