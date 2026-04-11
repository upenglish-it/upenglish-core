export const GrammarQuestionErrorCategoriesC = [
  'grammar',
  'vocabulary',
  'pronunciation',
  'fluency',
  'coherence',
  'task_achievement',
  'other',
] as const;

export const GrammarQuestionTargetSkillsC = [
  'reading',
  'listening',
  'speaking',
  'writing',
  'grammar',
  'vocabulary',
] as const;

export const GrammarQuestionTypesC = [
  'multiple_choice',
  'fill_in_blank',
  'write',
  'speak',
  'fill_in_blank_paragraph',
  'match_words',
] as const;

export const GrammarQuestionSpecialRequirementC = ['', 'audio_required'] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTGrammarQuestionsCN = 'sst-grammar-questions';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: SSTGrammarQuestionsCN } })
export class SSTGrammarQuestions {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: Boolean, default: false })
  public readonly hasContext: boolean;

  @Prop({ type: String, enum: GrammarQuestionErrorCategoriesC })
  public readonly errorCategory: GrammarQuestionErrorCategoriesT;

  @Prop({ type: Array, default: [] })
  public readonly variations: Record<string, any>[];

  @Prop({ type: String, default: null })
  public readonly teacherId: string;

  @Prop({ type: String, enum: GrammarQuestionTargetSkillsC })
  public readonly targetSkill: GrammarQuestionTargetSkillsT;

  @Prop({ type: String, required: true })
  public readonly exerciseId: string;

  @Prop({ type: String, default: null })
  public readonly context: string;

  @Prop({ type: String, default: null })
  public readonly contextAudioUrl: string;

  // In the original app this is a freeform teacher/admin objective text,
  // not an enum such as "main" or "follow_up".
  @Prop({ type: String, default: '' })
  public readonly purpose: string;

  @Prop({ type: String, enum: GrammarQuestionTypesC, required: true })
  public readonly type: GrammarQuestionTypesT;

  @Prop({ type: Number, default: 0 })
  public readonly order: number;

  @Prop({ type: Number, default: 1 })
  public readonly points: number;

  @Prop({ type: String, enum: GrammarQuestionSpecialRequirementC, default: '' })
  public readonly specialRequirement: GrammarQuestionSpecialRequirementT;

  @Prop({ type: String, default: null })
  public readonly promptTitle: string;

  @Prop({ type: String, default: null })
  public readonly promptId: string;

  @Prop({ type: Boolean, default: true })
  public readonly useDefaultGradingCriteria: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly useAIGrading: boolean;

  @Prop({ type: Number, default: null })
  public readonly timeLimitSeconds: number;

  @Prop({ ref: () => Accounts, type: String, required: false })
  public readonly createdBy?: Accounts;

  @Prop({ ref: () => Properties, type: String, required: false })
  public readonly properties?: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: false })
  public readonly propertiesBranches?: PropertiesBranches;
}

export type GrammarQuestionErrorCategoriesT = (typeof GrammarQuestionErrorCategoriesC)[number];
export type GrammarQuestionTargetSkillsT = (typeof GrammarQuestionTargetSkillsC)[number];
export type GrammarQuestionTypesT = (typeof GrammarQuestionTypesC)[number];
export type GrammarQuestionSpecialRequirementT = (typeof GrammarQuestionSpecialRequirementC)[number];
