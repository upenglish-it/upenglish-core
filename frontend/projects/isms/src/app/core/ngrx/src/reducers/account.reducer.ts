import { IAccount } from "@isms-core/interfaces";
import * as Action from "../actions/account.action";

const initialState: IAccount = null;

export function AccountReducer(state: any = initialState, action: Action.AccountActions): IAccount {
  switch (action.type) {
    case Action.UPDATE_ACCOUNT:
      return action.payload;
    default:
      return state;
  }
}
