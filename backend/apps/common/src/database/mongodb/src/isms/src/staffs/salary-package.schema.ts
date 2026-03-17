import { Prop, modelOptions } from '@typegoose/typegoose';
import { Accounts } from '../accounts';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'staffs-salary-package' } })
export class StaffsSalaryPackage {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: String, required: true })
  public name: string;

  @Prop({ type: String, required: true })
  public jobTitle: string;

  @Prop({ type: String, required: true })
  public typeOfLabor: string;

  @Prop({ type: Number, required: true })
  public basicSalary: number;

  @Prop({ type: Number, required: true })
  public consultingCommission: number;

  @Prop({ type: Number, required: true })
  public hourlyTeachingRate: number;

  @Prop({ type: Number, required: true })
  public hourlyTutoringRate: number;

  @Prop({ type: Number, required: true })
  public hourlyTAPARate: number;

  @Prop({ type: Number, required: true })
  public insuranceAmount: number;

  @Prop({ type: Number, required: true })
  public employeePay: number;

  @Prop({ type: Number, required: true })
  public companyPay: number;

  // @Prop({ type: Array, default: [] })
  // public changeLogs: Array<{
  //   id: string;
  //   performedBy: string;
  //   action: 'insert' | 'update';
  //   createdAt: string;
  // }>;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public addedBy: Accounts;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public staff: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}
