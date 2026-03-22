// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTRewardPointsCN = 'sst-reward-points';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTRewardPointsCN } })
export class SSTRewardPoints {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly displayName: string;

  @Prop({ type: Number, required: true })
  public readonly points: number;

  @Prop({ type: Date, required: true })
  public readonly migratedAt: Date;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
