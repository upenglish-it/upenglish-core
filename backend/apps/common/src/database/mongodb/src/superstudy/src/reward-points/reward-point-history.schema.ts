// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTRewardPointHistoryCN = 'sst-reward-point-history';
export const RewardPointHistoryTypeC = ['earn', 'deduct', 'redeem'] as const;

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTRewardPointHistoryCN } })
export class SSTRewardPointHistory {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly userId: string;

  @Prop({ type: String, enum: RewardPointHistoryTypeC, required: true })
  public readonly type: RewardPointHistoryTypeT;

  @Prop({ type: Number, required: true })
  public readonly amount: number;

  @Prop({ type: String, default: '' })
  public readonly reason: string;

  @Prop({ type: String, default: '' })
  public readonly giftName: string;

  @Prop({ type: String, default: '' })
  public readonly groupId: string;

  @Prop({ type: String, default: '' })
  public readonly groupName: string;

  @Prop({ ref: () => Accounts, type: String, required: false, default: null })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: false, default: null })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: false, default: null })
  public readonly propertiesBranches: PropertiesBranches;
}

export type RewardPointHistoryTypeT = (typeof RewardPointHistoryTypeC)[number];
