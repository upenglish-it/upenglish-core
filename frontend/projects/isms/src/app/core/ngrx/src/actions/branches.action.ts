import { IBranch } from "@isms-core/interfaces";
import { Action } from "@ngrx/store";

export const GET_BRANCHES = "[BRANCHES] GET";
export const UPDATE_BRANCHES = "[BRANCHES] UPDATE";

export class GetBranches implements Action {
  readonly type = GET_BRANCHES;
  constructor(public payload: Array<IBranch>) {}
}

export class UpdateBranches implements Action {
  readonly type = UPDATE_BRANCHES;
  constructor(public payload: Array<IBranch>) {}
}

export type BranchesActions = GetBranches | UpdateBranches;
