// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTGrammarProgressCN = 'sst-grammar-progress';

@modelOptions({
  options: { allowMixed: Severity.ALLOW },
  schemaOptions: {
    timestamps: true,
    versionKey: false,
    collection: SSTGrammarProgressCN,
  },
})
export class SSTGrammarProgress {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true, index: true })
  public readonly userId: string;

  @Prop({ type: String, required: true, index: true })
  public readonly questionId: string;

  @Prop({ type: String, required: true, index: true })
  public readonly exerciseId: string;

  @Prop({ type: Number, default: 0 })
  public readonly level: number;

  @Prop({ type: Number, default: 0 })
  public readonly interval: number;

  @Prop({ type: Date, default: null })
  public readonly nextReview: Date;

  @Prop({ type: Date, default: null })
  public readonly lastStudied: Date;

  @Prop({ type: Number, default: 0 })
  public readonly failCount: number;

  @Prop({ type: Number, default: 0 })
  public readonly passCount: number;

  @Prop({ type: [Number], default: [] })
  public readonly variationsPassed: number[];

  @Prop({ type: [Number], default: [] })
  public readonly variationsFailed: number[];

  @Prop({ type: Number, default: null })
  public readonly lastVariationAttempted: number;

  @Prop({ type: String, default: '' })
  public readonly lastLeveledDay: string;

  @Prop({ type: Number, default: 4 })
  public readonly totalVariations: number;

  @Prop({ ref: () => Accounts, type: String, required: false })
  public readonly createdBy?: Accounts;

  @Prop({ ref: () => Properties, type: String, required: false })
  public readonly properties?: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: false })
  public readonly propertiesBranches?: PropertiesBranches;
}
