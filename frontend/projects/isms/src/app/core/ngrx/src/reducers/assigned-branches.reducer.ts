import { IBranch } from "@isms-core/interfaces";
import * as Action from "../actions/assigned-branches.action";

const initialState: Array<IBranch> = [];

export function AssignedBranchesReducer(state: any = initialState, action: Action.AssignedBranchesActions): Array<IBranch> {
  switch (action.type) {
    case Action.UPDATE_ASSIGNED_BRANCHES:
      return action.payload;
    default:
      return state;
  }
}
