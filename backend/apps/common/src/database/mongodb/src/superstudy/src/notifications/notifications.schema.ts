export const NotificationTypesC = [
  'exam_assigned',
  'exam_assignment_new',
  'assignment_new',
  'deadline_extended',
  'account_approved',
  'student_joined',
  'resource_shared',
  'content_proposal',
  'proposal_approved',
  'proposal_rejected',
  'result_released',
  'follow_up_released',
  'exam_graded',
  'new_user_pending',
  'feedback_admin',
  'feedback_direct',
] as const;

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

  @Prop({ type: String, enum: NotificationTypesC, required: true })
  public readonly type: NotificationTypesT;

  @Prop({ type: String, required: true })
  public readonly title: string;

  @Prop({ type: String, required: true })
  public readonly message: string;

  @Prop({ type: String, default: null })
  public readonly link: string;

  @Prop({ type: String, required: true })
  public readonly userId: string;

  @Prop({ type: Boolean, default: false })
  public readonly isRead: boolean;

  @Prop({ type: Date, default: null })
  public readonly readAt: Date;

  @Prop({ ref: () => Accounts, type: String, required: false, default: null })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: false, default: null })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: false, default: null })
  public readonly propertiesBranches: PropertiesBranches;
}

export type NotificationTypesT = (typeof NotificationTypesC)[number];
