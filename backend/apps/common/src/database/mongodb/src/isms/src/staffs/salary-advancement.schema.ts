import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
import { Accounts } from '../accounts';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: 'staffs-salary-advancement' } })
export class StaffsSalaryAdvancement {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: Number, required: true })
  public loanedAmount: number;

  @Prop({ type: Number, default: 0 })
  public paidAmount: number;

  @Prop({ type: Number, default: 0 })
  public paymentSequence: number; // number of payments when it will show again

  @Prop({ type: Object, default: { amount: 0, every: 0 } })
  public agreement: {
    amount: number; // amount to pay
    every: number; // Ex: pay every 3rd payout
  };

  @Prop({ type: Array, default: [] })
  public transactions: Array<StaffsSalaryAdvancementTransaction>;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public staff: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}

interface StaffsSalaryAdvancementTransaction {
  type: 'loan' | 'payment';
  date: string;
  performedBy: string;
}
