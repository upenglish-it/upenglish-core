import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const orderId = require('order-id')(process.env.ORDER_NUMBER_KEY);
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { Accounts } from '../accounts';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: 'cashflow' } })
export class Cashflow {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  @Prop({ type: String, default: () => orderId.generate() })
  public transactionId: string;

  // @Prop({
  //   type: String,
  //   default: () => orderId.generate(),
  // })
  // public secondaryTransactionId: string;

  @Prop({ type: Number, required: true })
  public amount: string;

  @Prop({ type: Number, default: 0 })
  public quantity: number;

  @Prop({ type: String, required: true })
  public notes: string;

  @Prop({ ref: () => Accounts, type: String, required: false })
  public payedBy: Accounts;

  @Prop({ type: String, required: false })
  public payedByNonMember: string;

  @Prop({ ref: () => Accounts, type: String })
  public receivedBy: Accounts;

  // /**
  //  * @classes if student pay the tuition in class
  //  * */
  // @Prop({ ref: () => Classes, type: String })
  // public classes: Classes;

  /**
   * @tuition if student pay the tuition in class
   * */
  @Prop({ type: Object, default: null })
  public tuition: {
    tuitionAttendance: string;
    urlCode: string;
  };

  /**
   * @salary if staff get paid
   * */
  @Prop({ type: Object, default: null })
  public salary: {
    salaryPayment: string;
    urlCode: string;
  };

  /**
   **@materials if someone purchase a material
   * */
  @Prop({ type: Object, required: false })
  public material: CashflowMaterial;

  // /**
  //  * *@materials if purchase a book  */
  // @Prop({ ref: () => Materials, type: String })
  // public materials: Materials;

  @Prop({ type: String, required: true })
  public mode: TIncomeMode;

  @Prop({ type: String, required: true })
  public type: TIncomeType;

  @Prop({ type: String, default: null })
  public from: 'deposit' | 'material' | 'tutoring' | 'tuition-refund';

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}

type TIncomeMode = 'cash' | 'bank';
type TIncomeType = 'income' | 'expense';

// export interface CashflowTuition {
//   tuitionAttendance: string;
// }

type TCashflowTuitionStatus = 'paid-monthly' | 'paid-package' | 'stop-learning' | 'cant-pay-this-month' | 'cant-pay-tuition';

export interface CashflowMaterial {
  material: string;
  materialName: string;
  quantity: number;
}
