import { Prop, Severity, modelOptions } from '@typegoose/typegoose';
import { Accounts } from '../accounts';
import { PropertiesBranches } from '../properties/branches';
import { Properties } from '../properties';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({
  schemaOptions: {
    timestamps: true,
    versionKey: false,
    collection: 'recruitment-recruiter-socketio',
  },
  options: {
    allowMixed: Severity.ALLOW,
  },
})
export class ConnectionSocketIO {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly socketId: string;

  @Prop({ type: String, required: true })
  public readonly userAgent: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly account: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;
}
