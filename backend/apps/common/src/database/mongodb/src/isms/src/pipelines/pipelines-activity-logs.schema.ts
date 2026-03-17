import { Prop, Severity, modelOptions } from '@typegoose/typegoose';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { Accounts } from '../accounts';
import { Pipelines } from './pipelines.schema';

@modelOptions({
  schemaOptions: { timestamps: true, versionKey: false, collection: 'pipelines-activity-logs' },
  options: { allowMixed: Severity.ALLOW },
})
export class PipelinesActivityLogs {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly type: 'add-note' | 'assign-to-stage';

  @Prop({ type: String, default: null })
  public readonly message: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public createdBy: Accounts;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public lead: Accounts;

  @Prop({ ref: () => Pipelines, type: String, required: true })
  public pipeline: Pipelines;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, default: false })
  public readonly deleted: boolean;
}
