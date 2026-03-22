const ExamSubmissionStatusC = [''] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTExamSubmissionsCN = 'sst-exam-submissions';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTExamSubmissionsCN } })
export class SSTExamSubmissions {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly examId: string;

  @Prop({ type: String, required: true })
  public readonly assignmentId: string;

  @Prop({ type: String, required: true })
  public readonly studentId: string;

  @Prop({ type: String, required: true })
  public readonly startedAt: string;

  @Prop({ type: String, required: true })
  public readonly examEndTime: string;

  @Prop({ type: Array, required: true })
  public readonly variationMap: string[];

  @Prop({ type: String, required: true })
  public readonly questionTimers: string[];

  @Prop({ type: Number, required: true })
  public readonly sectionExpired: number;

  @Prop({ type: Number, required: true })
  public readonly questionExpired: number;

  @Prop({ type: Boolean, required: true })
  public readonly autoSubmitted: boolean;

  @Prop({ type: String, required: true })
  public readonly submittedAt: string;

  @Prop({ type: Number, required: true })
  public readonly maxTotalScore: number;

  @Prop({ type: String, required: true })
  public readonly gradedAt: string;

  @Prop({ type: String, required: true })
  public readonly results: string;

  @Prop({ type: Number, required: true })
  public readonly totalScore: number;

  @Prop({ type: String, enum: ExamSubmissionStatusC, required: true })
  public readonly status: ExamSubmissionStatusT;

  @Prop({ type: Boolean, required: true })
  public readonly resultsReleased: boolean;

  @Prop({ type: String, required: true })
  public readonly releasedAt: string;

  @Prop({ type: String, required: true })
  public readonly releasedBy: string;

  @Prop({ type: String, required: true })
  public readonly releasedByName: string;

  @Prop({ type: Boolean, required: true })
  public readonly viewedByStudent: boolean;

  @Prop({ type: Number, required: true })
  public readonly tabSwitchCount: number;

  @Prop({ type: Number, required: true })
  public readonly lastActiveSectionIdx: number;

  @Prop({ type: Number, required: true })
  public readonly lastActiveQuestionIdx: number;

  @Prop({ type: Boolean, required: true })
  public readonly followUpRequested: boolean;

  @Prop({ type: String, required: true })
  public readonly timersSavedAt: string;

  @Prop({ type: String, required: true })
  public readonly followUpAnswers: string;

  @Prop({ type: String, required: true })
  public readonly followUpResults: string;

  @Prop({ type: String, required: true })
  public readonly followUpReleasedBy: string;

  @Prop({ type: Boolean, required: true })
  public readonly followUpResultsReleased: boolean;

  @Prop({ type: String, required: true })
  public readonly followUpReleasedAt: string;

  @Prop({ type: String, required: true })
  public readonly followUpReleasedByName: string;

  @Prop({ type: Boolean, required: true })
  public readonly followUpResultsViewedByStudent: boolean;

  @Prop({ type: String, required: true })
  public readonly examSummary: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

/**
 * @interface     ExamSubmissionStatusT
 * @description   Exam Submission Status Type
 */
export type ExamSubmissionStatusT = (typeof ExamSubmissionStatusC)[number];
