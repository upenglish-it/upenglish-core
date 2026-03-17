import { ActionReducerMap } from "@ngrx/store";
export * from "./src/state";
export * from "./src/store/index";
import { NGRX_STATE } from "./src/state";
import { AccountReducer } from "./src/reducers/account.reducer";
import { AssignedBranchesReducer } from "./src/reducers/assigned-branches.reducer";
import { BranchesReducer } from "./src/reducers/branches.reducer";
import { SelectedBranchReducer } from "./src/reducers/selected-branch.reducer";

export const NGRX_REDUCERS: ActionReducerMap<NGRX_STATE, any> = {
  ACCOUNT: AccountReducer,
  ASSIGNED_BRANCHES: AssignedBranchesReducer,
  BRANCHES: BranchesReducer,
  SELECTED_BRANCH: SelectedBranchReducer,
};
