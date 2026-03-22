const ViolationTypesC = [''] as const;
const RemoveByRolesC = [''] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTRedFlagsCN = 'sst-red-flags';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTRedFlagsCN } })
export class SSTRedFlags {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly studentId: string;

  @Prop({ type: String, required: true })
  public readonly studentName: string;

  @Prop({ type: String, required: true })
  public readonly studentEmail: string;

  @Prop({ type: String, required: true })
  public readonly groupId: string;

  @Prop({ type: String, required: true })
  public readonly groupName: string;

  @Prop({ type: String, enum: ViolationTypesC, required: true })
  public readonly violationType: ViolationTypesT;

  @Prop({ type: String, required: true })
  public readonly violationLabel: string;

  @Prop({ type: String, required: true })
  public readonly note: string;

  @Prop({ type: String, required: true })
  public readonly flaggedBy: string;

  @Prop({ type: String, required: true })
  public readonly flaggedByName: string;

  @Prop({ type: Number, required: true })
  public readonly flagNumber: number;

  @Prop({ type: Boolean, required: true })
  public readonly removed: boolean;

  @Prop({ type: String, required: true })
  public readonly removedByName: string;

  @Prop({ type: String, enum: RemoveByRolesC, required: true })
  public readonly removedByRole: RemoveByRolesT;

  @Prop({ type: String, required: true })
  public readonly removedBy: string;

  @Prop({ type: String, required: true })
  public readonly removeReason: string;

  @Prop({ type: Date, required: true })
  public readonly removedAt: Date;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

/**
 * @interface     ViolationTypesT
 * @description   Violation Types Type
 *
 */
export type ViolationTypesT = (typeof ViolationTypesC)[number];

/**
 * @interface     RemoveByRolesT
 * @description   Remove By Roles Type
 *
 */
export type RemoveByRolesT = (typeof RemoveByRolesC)[number];
