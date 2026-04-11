// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTGrammarSubmissionsCN = 'sst-grammar-submissions';

@modelOptions({
  options: { allowMixed: Severity.ALLOW },
  schemaOptions: {
    timestamps: true,
    versionKey: false,
    collection: SSTGrammarSubmissionsCN,
  },
})
export class SSTGrammarSubmissions {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true, index: true })
  public readonly assignmentId: string;

  @Prop({ type: String, required: true, index: true })
  public readonly studentId: string;

  @Prop({ type: Object, default: {} })
  public readonly answers: Record<string, any>;

  @Prop({ type: Object, default: {} })
  public readonly results: Record<string, any>;

  @Prop({ type: String, default: null })
  public readonly status: string;

  @Prop({ ref: () => Accounts, type: String, required: false })
  public readonly createdBy?: Accounts;

  @Prop({ ref: () => Properties, type: String, required: false })
  public readonly properties?: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: false })
  public readonly propertiesBranches?: PropertiesBranches;
}
