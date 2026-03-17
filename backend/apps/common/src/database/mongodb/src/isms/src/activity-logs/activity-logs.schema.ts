import { Prop, modelOptions } from '@typegoose/typegoose';
import { Accounts } from '../accounts';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'activity-logs' } })
export class ActivityLogs {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: String, required: true })
  public action: 'create-a-lead' | 'receive-payment-from-material' | 'receive-payment-from-tuition' | 'student-stop-learning' | 'expense';

  @Prop({ type: String, default: null })
  public message: string;

  @Prop({ type: Object, default: null })
  public data: {
    pipelineId?: string;
    pipelineStageId?: string;
  };

  @Prop({ ref: () => Accounts, type: String, required: true })
  public createdBy: Accounts;

  // use for income=class and lead=account
  @Prop({ ref: () => Accounts, type: String })
  public student: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}
