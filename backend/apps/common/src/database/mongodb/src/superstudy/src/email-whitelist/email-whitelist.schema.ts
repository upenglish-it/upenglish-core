export const EmailWhitelistRolesC = ['user', 'teacher', 'admin'] as const;

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

  // The email that is whitelisted
  @Prop({ type: String, required: true })
  public readonly email: string;

  // Role to assign when this user registers
  @Prop({ type: String, enum: EmailWhitelistRolesC, required: true })
  public readonly role: EmailWhitelistRolesT;

  // Display name of the person being whitelisted
  @Prop({ type: String, default: null })
  public readonly displayName: string;

  // How many days of access to grant on first approval
  @Prop({ type: Number, default: 365 })
  public readonly durationDays: number;

  // Optional hard expiry override (ISO date string)
  @Prop({ type: String, default: null })
  public readonly customExpiresAt: string;

  // UID of the admin who added this entry
  @Prop({ type: String, default: null })
  public readonly addedBy: string;

  // Groups to auto-enroll into on approval
  @Prop({ type: [String], default: [] })
  public readonly groupIds: string[];

  // Pre-assigned access lists (mirrors user access fields)
  @Prop({ type: [String], default: [] })
  public readonly folderAccess: string[];

  @Prop({ type: [String], default: [] })
  public readonly topicAccess: string[];

  @Prop({ type: [String], default: [] })
  public readonly grammarAccess: string[];

  @Prop({ type: [String], default: [] })
  public readonly examAccess: string[];

  // When this entry was added (ISO string — kept for backwards compatibility with Firestore)
  @Prop({ type: String, default: null })
  public readonly addedAt: string;

  // Whether this email has already been used to register
  @Prop({ type: Boolean, default: false })
  public readonly used: boolean;

  // When the user registered (set by the system on approval)
  @Prop({ type: Date, default: null })
  public readonly usedAt: Date;

  // Notes for admin
  @Prop({ type: String, default: null })
  public readonly notes: string;

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
