// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTTeacherRatingsCN = 'sst-teacher-ratings';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: SSTTeacherRatingsCN } })
export class SSTTeacherRatings {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly periodId: string;

  @Prop({ type: String, required: true })
  public readonly teacherId: string;

  @Prop({ type: String, required: true })
  public readonly studentId: string;

  @Prop({ type: String, required: true })
  public readonly groupId: string;

  @Prop({ type: Object, required: true })
  public readonly scores: Record<string, any>;

  @Prop({ type: Number, required: true })
  public readonly totalScore: number;

  @Prop({ type: String, required: true })
  public readonly comment: string;

  @Prop({ type: Boolean, required: true })
  public readonly eliminated: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly streakBonusAwarded?: boolean;

  @Prop({ type: Number, default: 0 })
  public readonly streakBonus?: number;

  @Prop({ type: Number, default: 0 })
  public readonly streakBonusBaseDays?: number;

  @Prop({ type: String, default: '' })
  public readonly streakBonusAwardedAt?: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
