// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTSettingsCN = 'sst-settings';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: SSTSettingsCN } })
export class SSTSettings {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, default: null, index: true })
  public readonly userId: string;

  @Prop({ type: String, default: null, index: true })
  public readonly type: string;

  @Prop({ type: Object, default: {} })
  public readonly reportPeriodDefaults: Record<string, any>;

  @Prop({ type: Array, default: [] })
  public readonly words: Record<string, any>[];

  @Prop({ type: Array, default: [] })
  public readonly lists: Record<string, any>[];

  @Prop({ type: Boolean, default: false })
  public readonly devBypassEnabled: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly allowRetryAiGrading: boolean;

  @Prop({ ref: () => Accounts, type: String, default: null })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, default: null })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, default: null })
  public readonly propertiesBranches: PropertiesBranches;
}
