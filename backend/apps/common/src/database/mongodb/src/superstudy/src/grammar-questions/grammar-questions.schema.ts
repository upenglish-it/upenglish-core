const GrammarQuestionErrorCategoriesC = [''] as const;
const GrammarQuestionTargetSkillsC = [''] as const;
const GrammarQuestionTypesC = [''] as const;
const GrammarQuestionPurposeC = [''] as const;
const GrammarQuestionSpecialRequirementC = [''] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTGrammarQuestionsCN = 'sst-grammar-questions';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTGrammarQuestionsCN } })
export class SSTGrammarQuestions {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: Boolean, required: true })
  public readonly hasContext: boolean;

  @Prop({ type: String, enum: GrammarQuestionErrorCategoriesC, required: true })
  public readonly errorCategory: GrammarQuestionErrorCategoriesT;

  @Prop({ type: Array, required: true })
  public readonly variations: string[];

  @Prop({ type: String, required: true })
  public readonly teacherId: string;

  @Prop({ type: String, enum: GrammarQuestionTargetSkillsC, required: true })
  public readonly targetSkill: GrammarQuestionTargetSkillsT;

  @Prop({ type: String, required: true })
  public readonly exerciseId: string;

  @Prop({ type: String, required: true })
  public readonly context: string;

  @Prop({ type: String, required: true })
  public readonly contextAudioUrl: string;

  @Prop({ type: String, enum: GrammarQuestionPurposeC, required: true })
  public readonly purpose: GrammarQuestionPurposeT;

  @Prop({ type: String, enum: GrammarQuestionTypesC, required: true })
  public readonly type: GrammarQuestionTypesT;

  @Prop({ type: Number, required: true })
  public readonly order: number;

  @Prop({ type: Number, required: true })
  public readonly points: number;

  @Prop({ type: String, enum: GrammarQuestionSpecialRequirementC, required: true })
  public readonly specialRequirement: GrammarQuestionSpecialRequirementT;

  @Prop({ type: String, required: true })
  public readonly promptTitle: string;

  @Prop({ type: String, required: true })
  public readonly promptId: string;

  @Prop({ type: Boolean, required: true })
  public readonly useDefaultGradingCriteria: boolean;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

/**
 * @interface     GrammarQuestionErrorCategoriesT
 * @description   Grammar Question Error Categories Type
 */
export type GrammarQuestionErrorCategoriesT = (typeof GrammarQuestionErrorCategoriesC)[number];

/**
 * @interface     GrammarQuestionTargetSkillsT
 * @description   Grammar Question Target Skills Type
 */
export type GrammarQuestionTargetSkillsT = (typeof GrammarQuestionTargetSkillsC)[number];

/**
 * @interface     GrammarQuestionTypesT
 * @description   Grammar Question Types Type
 *
 */
export type GrammarQuestionTypesT = (typeof GrammarQuestionTypesC)[number];

/**
 * @interface     GrammarQuestionPurposeT
 * @description   Grammar Question Purpose Type
 */
export type GrammarQuestionPurposeT = (typeof GrammarQuestionPurposeC)[number];

/**
 * @interface     GrammarQuestionSpecialRequirementT
 * @description   Grammar Question Special Requirement Type
 */
export type GrammarQuestionSpecialRequirementT = (typeof GrammarQuestionSpecialRequirementC)[number];
