const CategoryC = [''] as const;
const RolesC = [''] as const;
const TargetTypesC = [''] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTAnonymousFeedbackCN = 'sst-anonymous-feedback';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTAnonymousFeedbackCN } })
export class SSTAnonymousFeedback {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, required: true })
  public readonly message: string;

  @Prop({ type: String, enum: CategoryC, required: true })
  public readonly category: CategoryT;

  @Prop({ type: String, required: true })
  public readonly senderUid: string;

  @Prop({ type: String, required: true })
  public readonly senderName: string;

  @Prop({ type: String, required: true })
  public readonly senderEmail: string;

  @Prop({ type: String, enum: RolesC, required: true })
  public readonly senderRole: RolesT;

  @Prop({ type: String, enum: TargetTypesC, required: true })
  public readonly targetType: TargetTypesT;

  @Prop({ type: String, required: true })
  public readonly targetUid: string;

  @Prop({ type: String, required: true })
  public readonly targetName: string;

  @Prop({ type: String, required: true })
  public readonly targetEmail: string;

  @Prop({ type: String, required: true })
  public readonly hiddenBy: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, default: false })
  public read: boolean;
}

/**
 * @interface     CategoryT
 * @description   Category Type
 */
export type CategoryT = (typeof CategoryC)[number];

/**
 * @interface     RolesT
 * @description   Roles Type
 */
export type RolesT = (typeof RolesC)[number];

/**
 * @interface     TargetTypesT
 * @description   Target Types Type
 */
export type TargetTypesT = (typeof TargetTypesC)[number];
