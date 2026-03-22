// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTGrammarFoldersCN = 'sst-grammar-folders';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTGrammarFoldersCN } })
export class SSTGrammarFolders {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, required: true })
  public readonly description: string;

  @Prop({ type: String, required: true })
  public readonly icon: string;

  @Prop({ type: Number, required: true })
  @Prop({ type: Array, required: true })
  public readonly exerciseIds: string[];

  @Prop({ type: String, required: true })
  public readonly copiedFrom: string;

  @Prop({ type: String, required: true })
  public readonly proposedBy: string;

  @Prop({ type: Array, required: true })
  public readonly proposedByName: string[];

  @Prop({ type: Boolean, required: true })
  public readonly teacherVisible: boolean;

  @Prop({ type: Array, required: true })
  public readonly sharedWithTeacherIds: string[];

  @Prop({ type: Number, required: true })
  public readonly order: number;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
