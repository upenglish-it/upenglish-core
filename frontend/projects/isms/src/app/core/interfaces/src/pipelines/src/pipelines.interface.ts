import { IAccount } from "../../account/account.interface";

export interface Pipeline {
  _id: string;
  type: "leads" | "task";
  details: {
    title: string;
  };
  sourcingTeam: {
    ownerId: string;
    participantIds: Array<string>;
  };
  sourcingPipeline: {
    stages: Array<PipelineStage>;
  };
  status: PipelineStatus;
  createdBy: IAccount;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  // leads?: Array<PipelineLead>;
  items?: Array<PipelineLead | PipelineTasksItemI>;

  /* added in FE */
  selected?: boolean;
}

export type PipelineStatus = "active" | "inactive";

export interface PipelineStage {
  order: number;
  state: "start" | "mid" | "end";
  type: "inprogress" | "completed";
  title: string;
  color: string;
  id: string;
  editable: boolean;
  won: boolean; // use in won/lost stage
  // added in FE
  selected?: boolean;
  indeterminate?: boolean;
  leads?: Array<PipelineLead>;
  // used for task-type pipelines
  tasks?: Array<{ stageId?: string; taskId?: string; id: string; name?: string; notes?: string }>;
}

export interface PipelineLead {
  id: string;
  pipelineStageId: string;
  disqualification: {
    disqualified: boolean;
    reason: string;
  };
  order: number;
  addedAt: string;
  addedBy: string;
  info?: IAccount; // added in FE
}

export interface PipelineTasksItemI {
  /** Unique task id (for move/delete). New tasks get this on add. */
  taskId?: string;
  /** Stage id this task belongs to (used for grouping in fetch). */
  id: string;
  name?: string;
  notes?: string;
}
