export const EmailWhitelistRolesC = [''] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTEmailWhitelistCN = 'sst-email-whitelist';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTEmailWhitelistCN } })
export class SSTEmailWhitelist {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly email: string;

  @Prop({ type: String, enum: EmailWhitelistRolesC, required: true })
  public readonly role: EmailWhitelistRolesT;

  @Prop({ type: String, required: true })
  public readonly displayName: string;

  @Prop({ type: Number, required: true })
  public readonly durationDays: number;

  @Prop({ type: String, required: true })
  public readonly customExpiresAt: string;

  @Prop({ type: String, required: true })
  public readonly addedBy: string;

  @Prop({ type: String, required: true })
  public readonly groupIds: string[];

  @Prop({ type: String, required: true })
  public readonly folderAccess: boolean;

  @Prop({ type: Boolean, required: true })
  public readonly topicAccess: boolean;

  @Prop({ type: String, required: true })
  public readonly grammarAccess: boolean;

  @Prop({ type: String, required: true })
  public readonly examAccess: boolean;

  @Prop({ type: String, required: true })
  public readonly addedAt: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

/**
 * @interface     EmailWhitelistRolesT
 * @description   Email Whitelist Roles Type
 */
export type EmailWhitelistRolesT = (typeof EmailWhitelistRolesC)[number];
