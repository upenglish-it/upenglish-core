import { IAccount } from "@isms-core/interfaces";
import { Action } from "@ngrx/store";

export const GET_ACCOUNT = "[ACCOUNT] GET";
export const UPDATE_ACCOUNT = "[ACCOUNT] UPDATE";

export class GetAccount implements Action {
  readonly type = GET_ACCOUNT;
  constructor(public payload: IAccount) {}
}

export class UpdateAccount implements Action {
  readonly type = UPDATE_ACCOUNT;
  constructor(public payload: IAccount) {}
}

export type AccountActions = GetAccount | UpdateAccount;
