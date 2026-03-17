import { IAccount, IBranch } from "@isms-core/interfaces";

export interface NGRX_STATE {
  readonly ACCOUNT: IAccount;
  readonly BRANCHES: Array<IBranch>;
  readonly ASSIGNED_BRANCHES: Array<IBranch>;
  readonly SELECTED_BRANCH: string;
}
