import { IBranch } from "@isms-core/interfaces";
import * as Action from "../actions/branches.action";

const initialState: Array<IBranch> = [];

export function BranchesReducer(state: any = initialState, action: Action.BranchesActions): Array<IBranch> {
  switch (action.type) {
    case Action.UPDATE_BRANCHES:
      return action.payload;
    default:
      return state;
  }
}
