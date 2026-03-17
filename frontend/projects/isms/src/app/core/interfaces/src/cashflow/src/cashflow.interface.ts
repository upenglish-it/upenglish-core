import { IAccount } from "../../account/account.interface";
import { IMaterial } from "../../materials";

export interface ICashflow {
  _id: string;
  amount: 1000;
  notes: string;
  payedBy: IAccount;
  payedByNonMember: string;
  receivedBy: IAccount;
  mode: TCashflowMode;
  type: TCashflowType;
  quantity: number;
  properties: string;
  propertiesBranches: string;
  deleted: boolean;
  from: "deposit" | "material" | "tutoring" | "tuition-refund";
  transactionId: string;
  createdAt: string;
  updatedAt: string;
  material: {
    material: IMaterial;
    materialName: string;
    quantity: number;
  };
  tuition: {
    tuitionAttendance: string;
    urlCode: string;
    dates: string[];
    className: string;
  };
  salary: {
    salaryPayment: string;
    urlCode: string;
  };
}
export type TCashflowMode = "cash" | "banking";
export type TCashflowType = "income" | "expenses";
