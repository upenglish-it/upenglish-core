import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { Accounts } from '../accounts';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: 'leaves' } })
export class Leaves {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public staff: Accounts;

  @Prop({ type: Array, required: true })
  public dates: Array<ILeavesDate>;

  @Prop({ type: String, required: true })
  public notes: string;

  @Prop({ type: String, default: null })
  public approvalNotes: string;

  @Prop({ type: String, required: true })
  public type: TLeavesType;

  @Prop({ type: Number, required: true })
  public hours: number;

  @Prop({ type: String, required: true })
  public payable: 'unpaid' | 'paid';

  @Prop({ type: String, required: true, default: 'pending' })
  public status: TLeavesStatus;

  @Prop({ ref: () => Accounts, type: String, default: null })
  public statusUpdatedBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}

export type TLeavesType = 'pto' | 'uto' | 'sl' | 'el' | 'bl' | 'ml' | 'pl';
export type TLeavesStatus = 'pending' | 'approved' | 'rejected';
export interface ILeavesDate {
  from: string;
  to: string;
  date: string;
}
