import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
import { Accounts } from './accounts';
import { Properties } from './properties';
import { PropertiesBranches } from './properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: 'notifications' } })
export class Notifications {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: String, required: true })
  public actionType: TNotificationsActionType;

  @Prop({ type: String, required: true })
  public title: string;

  @Prop({ type: String })
  public message: string;

  @Prop({ type: Object, required: true })
  public data: {
    studentImportIndexingId?: string;
  };

  @Prop({ type: String, required: true, default: 'unread' })
  public status: TNotificationsStatus;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public accounts: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}

type TNotificationsStatus = 'read' | 'unread';
type TNotificationsActionType =
  | 'upload-bulk-student'
  | 'staff-payslip'
  | 'student-receipt'
  | 'assign-task-to-reviewer'
  | 'assign-task-to-participant'
  | 'participant-submit-task'
  | 'reviewer-reviewed-submitted-task'
  | 'lead-changes-in-pipeline';
