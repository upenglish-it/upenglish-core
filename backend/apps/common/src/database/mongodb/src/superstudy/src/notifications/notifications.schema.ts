const typesC = [''] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTNotificationsCN = 'sst-notifications';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTNotificationsCN } })
export class SSTNotifications {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, enum: typesC, required: true })
  public readonly type: typesT;

  @Prop({ type: String, required: true })
  public readonly title: string;

  @Prop({ type: String, required: true })
  public readonly message: string;

  @Prop({ type: String, required: true })
  public readonly link: string;

  @Prop({ type: String, required: true })
  public readonly userId: string;

  @Prop({ type: Boolean, required: true })
  public readonly isRead: boolean;

  @Prop({ type: Boolean, required: true })
  public readonly read: boolean;

  @Prop({ type: Date, required: true })
  public readonly readAt: Date;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

/**
 * @interface     typesT
 * @description   Types Type
 *
 */
export type typesT = (typeof typesC)[number];
