export const UserStatusC = [''] as const;
export const UserRoleC = ['admin', 'teacher', 'student'] as const;
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

  @Prop({ type: String, required: true })
  public readonly photoURL: string;

  @Prop({ type: String, enum: UserRoleC, required: true })
  public readonly role: UserRoleT;

  @Prop({ type: String, enum: UserStatusC, required: true })
  public readonly status: UserStatusT;

  @Prop({ type: Boolean, required: true })
  public readonly disabled: boolean;

  @Prop({ type: String, required: true })
  public readonly folderAccess: string;

  @Prop({ type: Array, required: true })
  public readonly topicAccess: string[];

  @Prop({ type: Array, required: true })
  public readonly grammarAccess: string[];

  @Prop({ type: Array, required: true })
  public readonly examAccess: string[];

  @Prop({ type: Array, required: true })
  public readonly groupIds: string[];

  @Prop({ type: String, required: true })
  public readonly approvedAt: string;

  @Prop({ type: String, required: true })
  public readonly expiresAt: string;

  @Prop({ type: String, required: true })
  public readonly deletedAt: string;

  @Prop({ type: Boolean, required: true })
  public readonly deleted: boolean;

  @Prop({ type: String, required: true })
  public readonly expiryNotifiedAt: string;

  @Prop({ type: String, required: true })
  public readonly displayName: string;

  @Prop({ type: String, enum: UserGenderC, required: true })
  public readonly gender: UserGenderT;

  @Prop({ type: String, required: true })
  public readonly teacherTitle: string;

  @Prop({ type: String, required: true })
  public readonly studentTitle: string;

  @Prop({ type: Object, required: true })
  public readonly emailPreferences: Record<string, any>;

  @Prop({ type: String, required: true })
  public readonly adminLanguage: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

/**
 * @interface     UserStatusT
 * @description   User Status Type
 */
export type UserStatusT = (typeof UserStatusC)[number];

/**
 * @interface     UserRoleT
 * @description   User Role Type
 */
export type UserRoleT = (typeof UserRoleC)[number];

/**
 * @interface     UserGenderT
 * @description   User Gender Type
 */
export type UserGenderT = (typeof UserGenderC)[number];
