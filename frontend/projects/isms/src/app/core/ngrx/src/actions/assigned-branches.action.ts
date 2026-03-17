import { IBranch } from "@isms-core/interfaces";
import { Action } from "@ngrx/store";

export const GET_ASSIGNED_BRANCHES = "[ASSIGNED_BRANCHES] GET";
export const UPDATE_ASSIGNED_BRANCHES = "[ASSIGNED_BRANCHES] UPDATE";

export class GetAssignedBranches implements Action {
  readonly type = GET_ASSIGNED_BRANCHES;
  constructor(public payload: Array<IBranch>) {}
}

export class UpdateAssignedBranches implements Action {
  readonly type = UPDATE_ASSIGNED_BRANCHES;
  constructor(public payload: Array<IBranch>) {}
}

export type AssignedBranchesActions = GetAssignedBranches | UpdateAssignedBranches;
