import { Prop, modelOptions } from '@typegoose/typegoose';
import { Accounts, Properties, PropertiesBranches } from '../../../isms';
import { SYSTEM_ID } from 'apps/common/src/utils';

export const IELTSPromptsCN = 'ielts-prompts';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: IELTSPromptsCN } })
export class IELTSPrompts {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  @Prop({ type: String, required: true })
  public name: string;

  @Prop({ type: String, required: true, enum: ['openai', 'gemini', 'openrouter'] })
  public provider: string;

  @Prop({ type: String, required: true })
  public model: string;

  @Prop({ type: String, required: true })
  public apiKey: string;

  @Prop({ type: String, required: true })
  public message: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}
