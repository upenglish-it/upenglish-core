import { IAccount } from "../../account/account.interface";
import { Pipeline, PipelineStage } from "./pipelines.interface";

export interface PipelineLeadInfo {
  leadInfo: IAccount;
  ownerInfo: IAccount;
  addedByInfo: IAccount;
  pipeline: Pipeline;
  currentPipelineStage: PipelineStage;
}
