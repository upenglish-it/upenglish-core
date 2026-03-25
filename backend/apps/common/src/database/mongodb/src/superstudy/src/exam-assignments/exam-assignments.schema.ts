export const ExamAssignmentTypesC = ['test', 'homework'] as const;
export const ExamAssignmentTargetTypesC = ['individual', 'group'] as const;
export const ExamAssignmentTeacherGendersC = ['male', 'female'] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTExamAssignmentsCN = 'sst-exam-assignments';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTExamAssignmentsCN } })
export class SSTExamAssignments {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  /** The group this assignment targets (if targetType === 'group') */
  @Prop({ type: String, default: null })
  public readonly groupId: string;

  @Prop({ type: String, required: true })
  public readonly examId: string;

  @Prop({ type: String, default: null })
  public readonly examName: string;

  @Prop({ type: Date, default: null })
  public readonly dueDate: Date;

  @Prop({ type: String, enum: ExamAssignmentTargetTypesC, required: true })
  public readonly targetType: ExamAssignmentTargetTypesT;

  @Prop({ type: String, required: true })
  public readonly targetId: string;

  @Prop({ type: String, default: null })
  public readonly targetName: string;

  @Prop({ type: String, default: null })
  public readonly teacherTitle: string;

  @Prop({ type: String, default: null })
  public readonly studentTitle: string;

  /** Random seed used to deterministically pick question variations for this assignment */
  @Prop({ type: Number, default: () => Math.floor(Math.random() * 100000) })
  public readonly variationSeed: number;

  @Prop({ type: Date, default: null })
  public readonly deadlineNotified: Date;

  @Prop({ type: String, default: null })
  public readonly examTitle: string;

  @Prop({ type: String, enum: ExamAssignmentTypesC, default: 'homework' })
  public readonly examType: ExamAssignmentTypesT;

  /**
   * Per-student individual deadline overrides.
   * Map of { [studentId]: Timestamp }
   */
  @Prop({ type: Object, default: {} })
  public readonly studentDeadlines: Record<string, any>;

  @Prop({ type: String, enum: ExamAssignmentTeacherGendersC, default: null })
  public readonly teacherGender: ExamAssignmentTeacherGendersT;

  @Prop({ type: String, default: null })
  public readonly assignedBy: string;

  @Prop({ type: String, default: null })
  public readonly assignedByName: string;

  /** Restrict assignment to specific students (empty = whole class) */
  @Prop({ type: Array, default: [] })
  public readonly assignedStudentIds: string[];

  @Prop({ type: String, default: null })
  public readonly toolId: string;

  @Prop({ type: Object, default: null })
  public readonly toolConfig: Record<string, any>;

  @Prop({ type: Boolean, default: false })
  public readonly allowMultipleAttempts: boolean;

  @Prop({ type: String, default: null })
  public readonly toolSubCategory: string;

  /** Scheduled release date (null = available immediately) */
  @Prop({ type: Date, default: null })
  public readonly scheduledStart: Date;

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

export type ExamAssignmentTypesT = (typeof ExamAssignmentTypesC)[number];
export type ExamAssignmentTargetTypesT = (typeof ExamAssignmentTargetTypesC)[number];
export type ExamAssignmentTeacherGendersT = (typeof ExamAssignmentTeacherGendersC)[number];
