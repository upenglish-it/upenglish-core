import { IAccount } from "../../account/account.interface";

export interface PipelineNote {
  title: string;
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
