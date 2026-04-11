export const ExamQuestionTypesC = [
  'multiple_choice',
  'fill_in_blank',
  'write',
  'speak',
  'fill_in_blank_paragraph',
  'match_words',
] as const;

export const ExamQuestionPurposesC = ['main', 'follow_up'] as const;

export const ExamQuestionErrorCategoriesC = [
  'grammar',
  'vocabulary',
  'pronunciation',
  'fluency',
  'coherence',
  'task_achievement',
  'other',
] as const;

export const ExamQuestionTargetSkillsC = [
  'reading',
  'listening',
  'speaking',
  'writing',
  'grammar',
  'vocabulary',
] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTExamQuestionsCN = 'sst-exam-questions';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: SSTExamQuestionsCN } })
export class SSTExamQuestions {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, enum: ExamQuestionTypesC, required: true })
  public readonly type: ExamQuestionTypesT;

  @Prop({ type: String, default: 'main' })
  public readonly purpose: string;

  @Prop({ type: String, default: null })
  public readonly targetSkill: string;

  @Prop({ type: Number, default: 1 })
  public readonly points: number;

  /** Whether this question has a shared reading/listening context above it */
  @Prop({ type: Boolean, default: false })
  public readonly hasContext: boolean;

  @Prop({ type: String, required: true })
  public readonly sectionId: string;

  @Prop({ type: String, required: true })
  public readonly examId: string;

  /**
   * Array of variation objects:
   * { text: string, options?: string[], correctAnswer?: string|string[], blanks?: string[] }
   * Using mixed/any for max flexibility (matches original Firestore dynamic shape)
   */
  @Prop({ type: Array, default: [] })
  public readonly variations: Record<string, any>[];

  @Prop({ type: String, default: null })
  public readonly errorCategory: string;

  @Prop({ type: Number, default: 0 })
  public readonly order: number;

  @Prop({ type: String, default: null })
  public readonly specialRequirement: string;

  @Prop({ type: Boolean, default: true })
  public readonly useDefaultGradingCriteria: boolean;

  @Prop({ type: String, default: null })
  public readonly promptId: string;

  @Prop({ type: String, default: null })
  public readonly promptTitle: string;

  @Prop({ type: Number, default: null })
  public readonly timeLimitSeconds: number;

  /** Teacher ID if this is a teacher-created question */
  @Prop({ type: String, default: null })
  public readonly teacherId: string;

  /** HTML context content (shared passage / audio context) */
  @Prop({ type: String, default: null })
  public readonly context: string;

  @Prop({ type: String, default: null })
  public readonly contextAudioUrl: string;

  @Prop({ type: Boolean, default: false })
  public readonly useAIGrading: boolean;

  @Prop({ ref: () => Accounts, type: String, required: false })
  public readonly createdBy?: Accounts;

  @Prop({ ref: () => Properties, type: String, required: false })
  public readonly properties?: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: false })
  public readonly propertiesBranches?: PropertiesBranches;
}

export type ExamQuestionTypesT = (typeof ExamQuestionTypesC)[number];
export type ExamQuestionPurposesT = (typeof ExamQuestionPurposesC)[number];
export type ExamQuestionErrorCategoriesT = (typeof ExamQuestionErrorCategoriesC)[number];
export type ExamQuestionTargetSkillsT = (typeof ExamQuestionTargetSkillsC)[number];
