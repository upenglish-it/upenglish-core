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

  @Prop({ type: String, required: true })
  public readonly color: string;

  @Prop({ type: String, required: true })
  public readonly icon: string;

  @Prop({ type: String, required: true })
  public readonly description: string;

  // Clarify what's this ID for
  // @Prop({ type: String, required: true })
  // public readonly id: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: Boolean, required: true })
  public readonly owner: boolean;

  @Prop({ type: Boolean, required: true })
  public readonly admin: boolean;

  @Prop({ type: Number, required: true })
  public readonly cachedWordCount: number;

  @Prop({ type: String, required: true })
  public readonly deletedAt: string;

  @Prop({ type: Boolean, required: true })
  public readonly deleted: boolean;

  @Prop({ type: String, required: true })
  public readonly duplicatedFrom: string;

  @Prop({ type: Array, required: true })
  public readonly collaborators: string[];

  @Prop({ type: Array, required: true })
  public readonly collaboratorNames: string[];

  @Prop({ type: Array, required: true })
  public readonly collaboratorIds: string[];

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
