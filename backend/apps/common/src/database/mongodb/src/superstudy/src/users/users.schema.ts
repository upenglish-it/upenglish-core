export const UserStatusC = ['pending', 'approved', 'expired'] as const;
export const UserRoleC = ['admin', 'teacher', 'student', 'user'] as const;
export const UserGenderC = ['male', 'female'] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTUsersCN = 'sst-users';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTUsersCN } })
export class SSTUsers {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly email: string;

  @Prop({ type: String, default: null })
  public readonly photoURL: string;

  @Prop({ type: String, enum: UserRoleC, default: 'user' })
  public readonly role: UserRoleT;

  @Prop({ type: String, enum: UserStatusC, default: 'pending' })
  public readonly status: UserStatusT;

  @Prop({ type: Boolean, default: false })
  public readonly disabled: boolean;

  /**
   * Topic folder IDs (and individual topic IDs) this user has access to.
   * In original Firestore this can hold both folder IDs and direct topic IDs.
   */
  @Prop({ type: Array, default: [] })
  public readonly folderAccess: string[];

  /** Direct topic IDs (not folders) this user has explicit access to */
  @Prop({ type: Array, default: [] })
  public readonly topicAccess: string[];

  /** Grammar exercise IDs this user has explicit access to */
  @Prop({ type: Array, default: [] })
  public readonly grammarAccess: string[];

  /** Exam IDs this user has explicit access to */
  @Prop({ type: Array, default: [] })
  public readonly examAccess: string[];

  /** Group IDs this user belongs to */
  @Prop({ type: Array, default: [] })
  public readonly groupIds: string[];

  @Prop({ type: Date, default: null })
  public readonly approvedAt: Date;

  /** Access expiry date (null = never expires) */
  @Prop({ type: Date, default: null })
  public readonly expiresAt: Date;

  @Prop({ type: Boolean, default: false })
  public readonly deleted: boolean;

  @Prop({ type: Date, default: null })
  public readonly deletedAt: Date;

  /** Track if expiry notification has been sent */
  @Prop({ type: Date, default: null })
  public readonly expiryNotifiedAt: Date;

  @Prop({ type: String, default: null })
  public readonly displayName: string;

  @Prop({ type: String, default: null })
  public readonly gender: UserGenderT;

  @Prop({ type: String, default: null })
  public readonly teacherTitle: string;

  @Prop({ type: String, default: null })
  public readonly studentTitle: string;

  /**
   * Email notification preferences per type:
   * { assignment_new: true, deadline_extended: false, ... }
   */
  @Prop({ type: Object, default: {} })
  public readonly emailPreferences: Record<string, any>;

  @Prop({ type: String, default: null })
  public readonly adminLanguage: string;

  @Prop({ ref: () => Accounts, type: String, required: false })
  public readonly createdBy?: Accounts;

  @Prop({ ref: () => Properties, type: String, required: false })
  public readonly properties?: Properties;

  @Prop({ ref: () => Array<PropertiesBranches>, type: Array, required: false })
  public readonly propertiesBranches?: Array<PropertiesBranches>;
}

export type UserStatusT = (typeof UserStatusC)[number];
export type UserRoleT = (typeof UserRoleC)[number];
export type UserGenderT = (typeof UserGenderC)[number];
