import { Prop, modelOptions } from '@typegoose/typegoose';
import { Accounts } from '../accounts';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { StaffsSalaryPackage } from './salary-package.schema';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'staffs-employment-information' } })
export class StaffsEmploymentInformation {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ ref: () => StaffsSalaryPackage, type: String, required: false, default: null })
  public salaryPackageId: StaffsSalaryPackage;

  @Prop({ type: String, required: false, default: null })
  public dateHired: string;

  @Prop({ type: Object, required: false, default: { count: 0, type: 'day' } })
  public salaryIncrease: {
    date: string;
    count: number;
    type: 'years' | 'months' | 'days';
  };

  ////  OLD

  // @Prop({ type: String, required: true })
  // public position: string;

  // @Prop({ type: String, required: true })
  // public typeOfLabor: string;

  // @Prop({ type: Array, required: true })
  // public workSchedule: Array<number>;

  // @Prop({ type: Number, required: true })
  // public basicSalary: number;

  // @Prop({ type: Number, required: true })
  // public dailySalary: number;

  // @Prop({ type: Number, required: true })
  // public consultingCommission: number;

  // @Prop({ type: Number, required: true })
  // public hourlyTeachingRate: number;

  // @Prop({ type: Number, required: true })
  // public hourlyTutoringRate: number;

  // @Prop({ type: Number, required: true })
  // public hourlyTAPARate: number;

  // @Prop({ type: Number, required: true })
  // public insuranceAmount: number;

  // @Prop({ type: Number, required: true })
  // public employeePay: number;

  // @Prop({ type: Number, required: true })
  // public companyPay: number;

  @Prop({ type: Array, default: [] })
  public changeLogs: Array<{
    id: string;
    performedBy: string;
    action: 'insert' | 'update';
    createdAt: string;
  }>;

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
