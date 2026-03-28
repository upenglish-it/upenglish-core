export const ExamTypesC = ['test', 'homework'] as const;
export const TargetLevelsC = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTExamsCN = 'sst-exams';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTExamsCN } })
export class SSTExams {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, default: null })
  public readonly description: string;

  @Prop({ type: String, default: null })
  public readonly icon: string;

  @Prop({ type: String, default: null })
  public readonly color?: string;

  @Prop({ type: Number, default: null })
  public readonly timeLimitMinutes: number;

  @Prop({ type: String, default: null })
  public readonly timingMode: string;

  @Prop({ type: Array, default: [] })
  public readonly sections: Record<string, any>[];

  /** Whether the exam is publicly available to all students */
  @Prop({ type: Boolean, default: false })
  public readonly isPublic: boolean;

  /** Whether teachers can see the exam in shared library (but not students) */
  @Prop({ type: Boolean, default: false })
  public readonly teacherVisible: boolean;

  @Prop({ type: String, default: null })
  public readonly cefrLevel: string;

  @Prop({ type: String, enum: ExamTypesC, default: 'homework' })
  public readonly examType: ExamTypesT;

  @Prop({ type: String, default: null })
  public readonly teacherTitle: string;

  @Prop({ type: String, default: null })
  public readonly studentTitle: string;

  @Prop({ type: Number, default: 0 })
  public readonly cachedQuestionTimeMissingCount: number;

  @Prop({ type: Number, default: 0 })
  public readonly cachedQuestionCount: number;

  @Prop({ type: Number, default: 0 })
  public readonly cachedQuestionTimeTotalSeconds: number;

  /** Soft-delete: set to true to hide from lists */
  @Prop({ type: Boolean, default: false })
  public readonly isDeleted: boolean;

  @Prop({ type: Date, default: null })
  public readonly deletedAt: Date;

  /** Teacher who owns this exam */
  @Prop({ type: Boolean, default: false })
  public readonly owner: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly admin: boolean;

  @Prop({ type: String, default: null })
  public readonly duplicatedFrom: string;

  @Prop({ type: Array, default: [] })
  public readonly collaborators: string[];

  @Prop({ type: Array, default: [] })
  public readonly collaboratorNames: string[];

  @Prop({ type: Array, default: [] })
  public readonly collaboratorIds: string[];

  @Prop({ type: Array, default: [] })
  public readonly collaboratorRoles: string[];

  /** Teacher IDs who have been individually shared this exam (admin sharing) */
  @Prop({ type: Array, default: [] })
  public readonly sharedWithTeacherIds: string[];

  @Prop({ type: String, default: null })
  public readonly title: string;

  @Prop({ type: String, default: null })
  public readonly copiedFrom: string;

  @Prop({ type: String, default: null })
  public readonly proposedBy: string;

  @Prop({ type: Array, default: [] })
  public readonly proposedByName: string[];

  @Prop({ type: String, default: null })
  public readonly teacherGender: string;

  @Prop({ type: Number, default: 0 })
  public readonly maxTotalScore: number;

  @Prop({ type: Boolean, default: false })
  public readonly archived: boolean;

  @Prop({ type: Date, default: null })
  public readonly transferredAt: Date;

  @Prop({ type: String, default: null })
  public readonly transferredToName: string;

  @Prop({ type: String, enum: TargetLevelsC })
  public readonly targetLevel?: TargetLevelsT;

  @Prop({ type: String, default: null })
  public readonly targetAge: string;

  @Prop({ type: String, default: null })
  public readonly convertedFrom: string;

  @Prop({ type: Date, default: null })
  public readonly restoredAt: Date;

  @Prop({ type: String, default: null })
  public readonly restoredFromTeacher: string;

  /** Folder this exam belongs to */
  @Prop({ type: String, default: null })
  public readonly folderId: string;

  /** Who created this — 'admin' | 'teacher' */
  @Prop({ type: String, default: null })
  public readonly createdByRole: string;

  /** Display name of the creator */
  @Prop({ type: String, default: null })
  public readonly createdByName: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: false })
  public readonly properties?: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: false })
  public readonly propertiesBranches?: PropertiesBranches;
}

/**
 * @interface     ExamTypesT
 * @description   Exam Types Type
 */
export type ExamTypesT = (typeof ExamTypesC)[number];

/**
 * @interface     TargetLevelsT
 * @description   Target Levels Type
 */
export type TargetLevelsT = (typeof TargetLevelsC)[number];
