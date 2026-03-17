import { IAccount } from "../../account/account.interface";

export interface ILeave {
  _id: string;
  dates: Array<{ date: string }>;
  notes: string;
  approvalNotes: string;
  status: TLeavesStatus;
  type: TLeavesType;
  deleted: boolean;
  properties: string;
  propertiesBranches: string;
  createdAt: string;
  updatedAt: string;
  staff: IAccount;
  payable: "unpaid" | "paid";
  hours: number;
  // added in FE
  selected?: boolean;
  totalDaysOfLeave?: number;
}

export type TLeavesType = "pto" | "uto" | "sl" | "el" | "bl" | "ml" | "pl" | "other";

export type TLeavesStatus = "pending" | "approved" | "rejected";
