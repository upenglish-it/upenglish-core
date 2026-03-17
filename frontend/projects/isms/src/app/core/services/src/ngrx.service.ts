import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { Store } from "@ngrx/store";
import { NgrxKeys } from "@isms-core/constants";
import { IAccount, IBranch } from "@isms-core/interfaces";

@Injectable({ providedIn: "root" })
export class NGRXService {
  constructor(
    public readonly accountStore: Store<any>,
    public readonly branchesStore: Store<any>,
    public readonly assignedBranchesStore: Store<any>,
    public readonly selectedBranchesStore: Store<any>
  ) {}

  public account(): Observable<IAccount> {
    return this.accountStore.select(NgrxKeys.ACCOUNT);
  }

  public assignedBranches(): Observable<Array<IBranch>> {
    return this.assignedBranchesStore.select(NgrxKeys.ASSIGNED_BRANCHES);
  }

  public branches(): Observable<Array<IBranch>> {
    return this.branchesStore.select(NgrxKeys.BRANCHES);
  }

  public selectedBranch(): Observable<string> {
    return this.selectedBranchesStore.select(NgrxKeys.SELECTED_BRANCH);
  }
}
