const MailQueueStatusC = ['pending', 'processing', 'sent', 'failed'] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTMailQueueCN = 'sst-mail-queue';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTMailQueueCN } })
export class SSTMailQueue {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly to: string;

  @Prop({ type: String, required: true })
  public readonly subject: string;

  @Prop({ type: String, required: true })
  public readonly html: string;

  @Prop({ type: Date, required: false, default: null })
  public readonly processedAt: Date;

  @Prop({ type: String, enum: MailQueueStatusC, required: false, default: 'pending' })
  public readonly status: MailQueueStatusT;

  @Prop({ ref: () => Accounts, type: String, required: false, default: null })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: false, default: null })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: false, default: null })
  public readonly propertiesBranches: PropertiesBranches;
}

/**
 * @interface     MailQueueStatusT
 * @description   Mail Queue Status Type
 *
 */
export type MailQueueStatusT = (typeof MailQueueStatusC)[number];
