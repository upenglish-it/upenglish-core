import { Prop, modelOptions } from '@typegoose/typegoose';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { Accounts } from '../accounts';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'integrations' } })
export class Integrations {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  @Prop({ type: String, required: false, default: false })
  public company: TIntegration;

  @Prop({ type: Object, required: true })
  public data: {
    application: TIntegrationApplication;

    // calendar
    info: any;
    token: any;
    sync: boolean; // can be use also for connect/disconnected
    syncDirection: TIntegrationDataSyncDirection;
    status: TIntegrationDataStatus;
  };

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly accounts: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}

type TIntegration = 'google' | 'microsoft';
type TIntegrationApplication = 'calendar';
type TIntegrationDataSyncDirection = 'one-way' | 'two-way';
type TIntegrationDataStatus = 'synching' | 'completed' | 'failed';
