import { Prop, modelOptions } from '@typegoose/typegoose';
import { Accounts } from '../accounts';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { nanoid } from 'nanoid';
import { StaffsSalaryAdvancement } from './salary-advancement.schema';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const orderId = require('order-id')(process.env.ORDER_NUMBER_KEY);

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'staffs-salary-payment' } })
export class StaffsSalaryPayment {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  @Prop({ type: String, default: () => nanoid() })
  public urlCode: string;

  @Prop({
    type: String,
    default: () => orderId.generate(),
  })
  public transactionId: string;

  @Prop({ type: Number, required: true })
  public totalStaffSalary: number;

  @Prop({ type: String, required: true })
  public dateIssued: string;

  @Prop({ type: String, required: true })
  public workStartDate: string;

  /* date of salary issued */
  @Prop({ type: String, required: true })
  public workEndDate: string;

  @Prop({ type: Number, default: 0 })
  public absences: number;

  @Prop({ type: Number, required: true })
  public basicSalary: number;

  @Prop({ type: Number, required: true })
  public dailyRate: number;

  @Prop({ type: Number, required: true })
  public consultingCommission: number;

  @Prop({ type: Number, required: true })
  public consultingCommissionQuantity: number;

  @Prop({ type: Number, required: true })
  public hourlyTeachingRate: number;

  @Prop({ type: Number, required: true })
  public hourlyTeachingRateQuantity: number;

  @Prop({ type: Number, required: true })
  public hourlyTutoringRate: number;

  @Prop({ type: Number, required: true })
  public hourlyTutoringRateQuantity: number;

  @Prop({ type: Number, required: true })
  public hourlyTAPARate: number;

  @Prop({ type: Number, required: true })
  public hourlyTAPARateQuantity: number;

  @Prop({ type: Number, default: 0 })
  public addition: number;

  @Prop({ type: Number, default: 0 })
  public subtraction: number;

  @Prop({ type: Number, required: true })
  public insuranceAmount: number;

  @Prop({ type: Number, required: true })
  public employeePay: number;

  @Prop({ type: Number, required: true })
  public companyPay: number;

  /* salary advancements */
  @Prop({ ref: () => StaffsSalaryAdvancement, type: String, default: null })
  public salaryAdvancement: StaffsSalaryAdvancement;

  @Prop({ type: Number, default: 0 })
  public salaryAdvancementLoanedAmount: number;

  @Prop({ type: Number, default: 0 })
  public salaryAdvancementAmountPay: number;

  @Prop({ type: Number, default: 0 })
  public salaryAdvancementBalance: number;

  @Prop({ type: Number, default: 0 })
  public totalOfUnpaidHours: number;

  @Prop({ type: Number, default: 0 })
  public totalAmountOfUnpaidHours: number;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public performedBy: Accounts;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public staff: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}
