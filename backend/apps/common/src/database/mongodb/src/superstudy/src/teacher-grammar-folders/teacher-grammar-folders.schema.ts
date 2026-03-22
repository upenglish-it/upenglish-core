// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTTeacherGrammarFoldersCN = 'sst-teacher-grammar-folders';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTTeacherGrammarFoldersCN } })
export class SSTTeacherGrammarFolders {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, required: true })
  public readonly description: string;

  @Prop({ type: String, required: true })
  public readonly icon: string;

  @Prop({ type: String, required: true })
  public readonly color: string;

  @Prop({ type: String, required: true })
  public readonly teacherId: string;

  @Prop({ type: Array, required: true })
  public readonly exerciseIds: string[];

  @Prop({ type: Boolean, required: true })
  public readonly appSystemFolder: boolean;

  @Prop({ type: Boolean, required: true })
  public readonly ownFolder: boolean;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
