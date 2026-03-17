import * as Action from "../actions/selected-branch.action";

const initialState: string = null;

export function SelectedBranchReducer(state: any = initialState, action: Action.SelectedBranchActions): string {
  switch (action.type) {
    case Action.UPDATE_SELECTED_BRANCHES:
      return action.payload;
    default:
      return state;
  }
}
