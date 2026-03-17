import { IAccount } from "../account/account.interface";

export interface IActivityLogs {
  _id: string;
  action: "create-a-lead" | "receive-payment-from-material" | "receive-payment-from-tuition" | "student-stop-learning" | "expense" | "assign-to-stage";
  message: string;
  data: {
    pipelineId: string;
    pipelineStageId: string;
  };
  createdBy: IAccount;
  student: IAccount;
  properties: string;
  propertiesBranches: string;
  deleted: false;
  createdAt: string;
  updatedAt: string;
}
