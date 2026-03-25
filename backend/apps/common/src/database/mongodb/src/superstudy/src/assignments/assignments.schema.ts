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

  @Prop({ type: String, default: null })
  public readonly topicName: string;

  @Prop({ type: Boolean, default: false })
  public readonly isTeacherTopic: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly isGrammar: boolean;

  @Prop({ type: Date, default: null })
  public readonly dueDate: Date;

  @Prop({ type: Date, default: null })
  public readonly deadlineNotified: Date;

  /**
   * Per-student individual deadline overrides: { [studentId]: Date }
   */
  @Prop({ type: Object, default: {} })
  public readonly studentDeadlines: Record<string, any>;

  /** Restrict to specific students (empty array = whole class) */
  @Prop({ type: Array, default: [] })
  public readonly assignedStudentIds: string[];

  /** Scheduled release date (null = publish immediately) */
  @Prop({ type: Date, default: null })
  public readonly scheduledStart: Date;

  @Prop({ type: String, default: null })
  public readonly groupName: string;

  @Prop({ type: String, default: null })
  public readonly teacherId: string;

  @Prop({ type: String, default: null })
  public readonly teacherName: string;

  @Prop({ type: Boolean, default: false })
  public readonly isDeleted: boolean;

  @Prop({ type: Date, default: null })
  public readonly deletedAt: Date;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
