// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTTeacherPromptsCN = 'sst-teacher-prompts';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTTeacherPromptsCN } })
export class SSTTeacherPrompts {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly skill: string;

  @Prop({ type: String, required: true })
  public readonly title: string;

  @Prop({ type: String, required: true })
  public readonly content: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
