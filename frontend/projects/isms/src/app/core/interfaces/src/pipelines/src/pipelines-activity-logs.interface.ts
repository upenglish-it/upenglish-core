import { IAccount } from "../../account/account.interface";

export interface PipelineActivityLog {
  type: "add-note" | "assign-to-stage";
  message: string;
  lead: IAccount;
  createdBy: IAccount;
  pipeline: string;
  properties: string;
  propertiesBranches: string;
  deleted: boolean;
  _id: string;
  createdAt: string;
  updatedAt: string;
}
