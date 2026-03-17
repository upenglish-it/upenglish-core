import { IAccount } from "../../account/account.interface";
import { IClass } from "../../classes";
import { Task } from "./tasks.interface";

export interface TaskSubmission {
  _id: string;
  task: Task;
  participant: IAccount;
  status: "reviewed" | "pending" | "incomplete";
  class: IClass;
  createdAt: string;
  updatedAt: string;
}
