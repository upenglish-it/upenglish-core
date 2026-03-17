import { Prop, modelOptions } from '@typegoose/typegoose';
import { Accounts } from './accounts';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'verification-logs' } })
export class VerificationLogs {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  _id: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  accountId: Accounts;

  @Prop({ type: String, required: true })
  token: string;
}
