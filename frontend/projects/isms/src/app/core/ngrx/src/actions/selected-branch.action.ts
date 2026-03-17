import { Action } from "@ngrx/store";

export const GET_SELECTED_BRANCHES = "[SELECTED BRANCH] GET";
export const UPDATE_SELECTED_BRANCHES = "[SELECTED BRANCH] UPDATE";

export class GetSelectedBranch implements Action {
  readonly type = GET_SELECTED_BRANCHES;
  constructor(public payload: string) {}
}

export class UpdateSelectedBranch implements Action {
  readonly type = UPDATE_SELECTED_BRANCHES;
  constructor(public payload: string) {}
}

export type SelectedBranchActions = GetSelectedBranch | UpdateSelectedBranch;
