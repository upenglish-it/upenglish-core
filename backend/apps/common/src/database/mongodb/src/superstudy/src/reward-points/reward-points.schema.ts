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

  /**
   * Compatibility field for the original Firestore path reward_points/{userId}.
   * Optional so pre-migration docs without it continue to work.
   */
  @Prop({ type: String, default: null })
  public readonly userId: string;

  @Prop({ type: String, default: '' })
  public readonly displayName: string;

  @Prop({ type: Number, default: 0 })
  public readonly points: number;

  @Prop({ type: Date, default: null })
  public readonly migratedAt: Date;

  @Prop({ ref: () => Accounts, type: String, required: false, default: null })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: false, default: null })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: false, default: null })
  public readonly propertiesBranches: PropertiesBranches;
}
