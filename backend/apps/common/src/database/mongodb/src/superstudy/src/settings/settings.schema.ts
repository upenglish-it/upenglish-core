// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTSettingsCN = 'sst-settings';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTSettingsCN } })
export class SSTSettings {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: Object, required: true })
  public readonly reportPeriodDefaults: Record<string, any>;

  @Prop({ type: Boolean, required: true })
  public readonly devBypassEnabled: boolean;

  @Prop({ type: Boolean, required: true })
  public readonly allowRetryAiGrading: boolean;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
