const typesC = [''] as const;
const purposesC = [''] as const;
const ErrorCategoriesC = [''] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTExamQuestionsCN = 'sst-exam-questions';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTExamQuestionsCN } })
export class SSTExamQuestions {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, enum: typesC, required: true })
  public readonly type: TypesT;

  @Prop({ type: String, enum: purposesC, required: true })
  public readonly purpose: PurposesT;

  @Prop({ type: String, required: true })
  public readonly targetSkill: string;

  @Prop({ type: Number, required: true })
  public readonly points: number;

  @Prop({ type: String, required: true })
  public readonly hasContext: boolean;

  @Prop({ type: String, required: true })
  public readonly sectionId: string;

  @Prop({ type: String, required: true })
  public readonly examId: string;

  @Prop({ type: Array, required: true })
  public readonly variations: string[];

  @Prop({ type: String, enum: ErrorCategoriesC, required: true })
  public readonly errorCategory: ErrorCategoriesT;

  @Prop({ type: Number, required: true })
  public readonly order: number;

  @Prop({ type: String, required: true })
  public readonly specialRequirement: string;

  @Prop({ type: Boolean, required: true })
  public readonly useDefaultGradingCriteria: boolean;

  @Prop({ type: String, required: true })
  public readonly promptId: string;

  @Prop({ type: String, required: true })
  public readonly promptTitle: string;

  @Prop({ type: Number, required: true })
  public readonly timeLimitSeconds: number;

  @Prop({ type: String, required: true })
  public readonly teacherId: string;

  @Prop({ type: String, required: true })
  public readonly context: string;

  @Prop({ type: String, required: true })
  public readonly contextAudioUrl: string;

  @Prop({ type: Boolean, required: true })
  public readonly useAIGrading: boolean;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

/**
 * @interface     TypesT
 * @description   Types Type
 */
export type TypesT = (typeof typesC)[number];

/**
 * @interface     PurposesT
 * @description   Purposes Type
 */
export type PurposesT = (typeof purposesC)[number];

/**
 * @interface     ErrorCategoriesT
 * @description   Error Categories Type
 */
export type ErrorCategoriesT = (typeof ErrorCategoriesC)[number];
