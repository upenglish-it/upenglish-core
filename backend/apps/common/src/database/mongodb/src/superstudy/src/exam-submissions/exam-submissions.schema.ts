export const ExamSubmissionStatusC = ['in_progress', 'submitted', 'graded'] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTExamSubmissionsCN = 'sst-exam-submissions';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: SSTExamSubmissionsCN } })
export class SSTExamSubmissions {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly examId: string;

  @Prop({ type: String, required: true })
  public readonly assignmentId: string;

  @Prop({ type: String, required: true })
  public readonly studentId: string;

  @Prop({ type: Date, default: null })
  public readonly startedAt: Date;

  /** Calculated deadline for this specific session */
  @Prop({ type: Date, default: null })
  public readonly examEndTime: Date;

  /**
   * Map of { [questionId]: variationIndex } — selected variations per question
   */
  @Prop({ type: Object, default: {} })
  public readonly variationMap: Record<string, number>;

  /**
   * Timer state per question: { [questionId]: remainingSeconds }
   */
  @Prop({ type: Object, default: {} })
  public readonly questionTimers: Record<string, number>;

  @Prop({ type: Number, default: 0 })
  public readonly sectionExpired: number;

  @Prop({ type: Number, default: 0 })
  public readonly questionExpired: number;

  @Prop({ type: Boolean, default: false })
  public readonly autoSubmitted: boolean;

  @Prop({ type: Date, default: null })
  public readonly submittedAt: Date;

  @Prop({ type: Number, default: 0 })
  public readonly maxTotalScore: number;

  @Prop({ type: Date, default: null })
  public readonly gradedAt: Date;

  /**
   * Grading results per question: { [questionId]: { score, feedback, ... } }
   */
  @Prop({ type: Object, default: {} })
  public readonly results: Record<string, any>;

  /**
   * Student answers per question: { [questionId]: answer }
   */
  @Prop({ type: Object, default: {} })
  public readonly answers: Record<string, any>;

  @Prop({ type: Number, default: 0 })
  public readonly totalScore: number;

  @Prop({ type: String, enum: ExamSubmissionStatusC, default: 'in_progress' })
  public readonly status: ExamSubmissionStatusT;

  @Prop({ type: Boolean, default: false })
  public readonly resultsReleased: boolean;

  @Prop({ type: Date, default: null })
  public readonly releasedAt: Date;

  @Prop({ type: String, default: null })
  public readonly releasedBy: string;

  @Prop({ type: String, default: null })
  public readonly releasedByName: string;

  @Prop({ type: Boolean, default: false })
  public readonly viewedByStudent: boolean;

  @Prop({ type: Number, default: 0 })
  public readonly tabSwitchCount: number;

  @Prop({ type: Number, default: 0 })
  public readonly lastActiveSectionIdx: number;

  @Prop({ type: Number, default: 0 })
  public readonly lastActiveQuestionIdx: number;

  @Prop({ type: Boolean, default: false })
  public readonly followUpRequested: boolean;

  @Prop({ type: Date, default: null })
  public readonly timersSavedAt: Date;

  /**
   * Student follow-up answers: { [questionId]: answer }
   */
  @Prop({ type: Object, default: {} })
  public readonly followUpAnswers: Record<string, any>;

  /**
   * Follow-up grading results: { [questionId]: { score, feedback, ... } }
   */
  @Prop({ type: Object, default: {} })
  public readonly followUpResults: Record<string, any>;

  @Prop({ type: String, default: null })
  public readonly followUpReleasedBy: string;

  @Prop({ type: Boolean, default: false })
  public readonly followUpResultsReleased: boolean;

  @Prop({ type: Date, default: null })
  public readonly followUpReleasedAt: Date;

  @Prop({ type: String, default: null })
  public readonly followUpReleasedByName: string;

  @Prop({ type: Boolean, default: false })
  public readonly followUpResultsViewedByStudent: boolean;

  /** AI-generated overall exam summary for student review */
  @Prop({ type: String, default: null })
  public readonly examSummary: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

export type ExamSubmissionStatusT = (typeof ExamSubmissionStatusC)[number];
