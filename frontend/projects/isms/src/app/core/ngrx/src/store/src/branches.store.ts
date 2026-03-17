/* eslint-disable no-unused-vars */
import { Injectable } from "@angular/core";
import { UpdateBranches } from "../../actions/branches.action";
import { lastValueFrom } from "rxjs";
import { IBranch } from "@isms-core/interfaces";
import { BranchesService, NGRXService } from "@isms-core/services";

@Injectable({
  providedIn: "root",
})
export class BranchesStore {
  constructor(
    private readonly ngrxService: NGRXService,
    private readonly branchesService: BranchesService
  ) {}
  public update(data: Array<IBranch>): void {
    this.ngrxService.branchesStore.dispatch(new UpdateBranches(data));
  }

  public load(): void {
    lastValueFrom(this.branchesService.fetch()).then((res) => {
      if (res.success) {
        const branches = (res.data as Array<IBranch>).filter((branch) => !branch.deleted);
        this.update(branches);
      }
    });
  }
}
