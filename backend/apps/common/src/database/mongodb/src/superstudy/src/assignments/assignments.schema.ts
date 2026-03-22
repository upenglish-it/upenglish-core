// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTAssignmentsCN = 'sst-assignments';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTAssignmentsCN } })
export class SSTAssignments {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly groupId: string;

  @Prop({ type: String, required: true })
  public readonly topicId: string;

  @Prop({ type: String, required: true })
  public readonly topicName: string;

  @Prop({ type: Boolean, required: true })
  public readonly isTeacherTopic: boolean;

  @Prop({ type: Boolean, required: true })
  public readonly isGrammar: boolean;

  @Prop({ type: String, required: true })
  public readonly dueDate: string;

  @Prop({ type: String, required: true })
  public readonly deadlineNotified: string;

  @Prop({ type: String, required: true })
  public readonly studentDeadlines: string;

  @Prop({ type: Array, required: true })
  public readonly assignedStudentIds: string[];

  @Prop({ type: String, required: true })
  public readonly scheduledStart: string;

  @Prop({ type: String, required: true })
  public readonly groupName: string;

  @Prop({ type: String, required: true })
  public readonly teacherId: string;

  @Prop({ type: String, required: true })
  public readonly teacherName: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, default: false })
  public readonly deleted: boolean;
}
