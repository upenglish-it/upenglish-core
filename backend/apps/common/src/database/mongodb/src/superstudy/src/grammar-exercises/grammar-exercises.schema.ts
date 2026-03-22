const GrammarExerciseTargetLevelsC = [''] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTGrammarExercisesCN = 'sst-grammar-exercises';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTGrammarExercisesCN } })
export class SSTGrammarExercises {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly title: string;

  @Prop({ type: String, required: true })
  public readonly description: string;

  @Prop({ type: String, required: true })
  public readonly icon: string;

  @Prop({ type: Number, required: true })
  public readonly color: number;

  @Prop({ type: String, required: true })
  public readonly createdByRole: string;

  @Prop({ type: String, required: true })
  public readonly copiedFrom: string;

  @Prop({ type: String, required: true })
  public readonly proposedBy: string;

  @Prop({ type: Array, required: true })
  public readonly proposedByName: string[];

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, enum: GrammarExerciseTargetLevelsC, required: true })
  public readonly targetLevel: GrammarExerciseTargetLevelsT;

  @Prop({ type: String, required: true })
  public readonly targetAge: string;

  @Prop({ type: String, required: true })
  public readonly teacherId: string;

  @Prop({ type: Number, required: true })
  public readonly cachedQuestionCount: number;

  @Prop({ type: Boolean, required: true })
  public readonly owner: boolean;

  @Prop({ type: String, required: true })
  public readonly duplicatedFrom: string;

  @Prop({ type: Array, required: true })
  public readonly collaborators: string[];

  @Prop({ type: Boolean, required: true })
  public readonly admin: boolean;

  @Prop({ type: String, default: null })
  public readonly deletedAt: string;

  @Prop({ type: Boolean, required: true })
  public readonly archived: boolean;

  @Prop({ type: String, default: null })
  public readonly convertedFrom: string;

  @Prop({ type: Boolean, required: true })
  public readonly public: boolean;

  @Prop({ type: String, required: true })
  public readonly transferredAt: string;

  @Prop({ type: String, required: true })
  public readonly transferredToName: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: true })
  public readonly deleted: boolean;
}

/**
 * @interface     GrammarExerciseTargetLevelsT
 * @description   Grammar Exercise Target Levels Type
 */
export type GrammarExerciseTargetLevelsT = (typeof GrammarExerciseTargetLevelsC)[number];
