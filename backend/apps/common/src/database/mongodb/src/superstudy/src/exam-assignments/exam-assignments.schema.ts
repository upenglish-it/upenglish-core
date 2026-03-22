const ExamAssignmentTypesC = [''] as const;
const ExamAssignmentTargetTypesC = [''] as const;
const ExamAssignmentTeacherGendersC = ['male', 'female'] as const;

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

  @Prop({ type: String, required: true })
  public readonly groupId: string;

  @Prop({ type: String, required: true })
  public readonly examId: string;

  @Prop({ type: String, required: true })
  public readonly examName: string;

  @Prop({ type: Number, required: true })
  public readonly dueDate: string;

  @Prop({ type: String, enum: ExamAssignmentTargetTypesC, required: true })
  public readonly targetType: ExamAssignmentTargetTypesT;

  @Prop({ type: String, required: true })
  public readonly targetId: string;

  @Prop({ type: String, required: true })
  public readonly teacherTitle: string;

  @Prop({ type: String, required: true })
  public readonly studentTitle: string;

  @Prop({ type: String, required: true })
  public readonly variationSeed: string;

  @Prop({ type: String, required: true })
  public readonly deadlineNotified: string;

  @Prop({ type: String, required: true })
  public readonly examTitle: string;

  @Prop({ type: String, enum: ExamAssignmentTypesC, required: true })
  public readonly examType: ExamAssignmentTypesT;

  @Prop({ type: String, required: true })
  public readonly studentDeadlines: string;

  @Prop({ type: String, enum: ExamAssignmentTeacherGendersC, required: true })
  public readonly teacherGender: ExamAssignmentTeacherGendersT;

  @Prop({ type: String, required: true })
  public readonly targetName: string;

  @Prop({ type: String, required: true })
  public readonly assignedBy: string;

  @Prop({ type: String, required: true })
  public readonly assignedByName: string;

  @Prop({ type: String, required: true })
  public readonly assignedStudentIds: string[];

  @Prop({ type: String, required: true })
  public readonly toolId: string;

  @Prop({ type: String, required: true })
  public readonly toolConfig: string;

  @Prop({ type: String, required: true })
  public readonly allowMultipleAttempts: boolean;

  @Prop({ type: String, required: true })
  public readonly toolSubCategory: string;

  @Prop({ type: String, required: true })
  public readonly scheduledStart: string;

  @Prop({ type: String, required: true })
  public readonly deletedAt: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;

  @Prop({ type: String, required: true })
  public readonly deleted: boolean;
}

/**
 * @interface     ExamAssignmentTypesT
 * @description   Exam Assignment Types Type
 */
export type ExamAssignmentTypesT = (typeof ExamAssignmentTypesC)[number];

/**
 * @interface     ExamAssignmentTargetTypesT
 * @description   Exam Assignment Target Types Type
 */
export type ExamAssignmentTargetTypesT = (typeof ExamAssignmentTargetTypesC)[number];

/**
 * @interface     ExamAssignmentTeacherGendersT
 * @description   Exam Assignment Teacher Genders Type
 */
export type ExamAssignmentTeacherGendersT = (typeof ExamAssignmentTeacherGendersC)[number];
