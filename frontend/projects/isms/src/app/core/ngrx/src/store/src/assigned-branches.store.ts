/* eslint-disable no-unused-vars */
import { Injectable } from "@angular/core";
import { UpdateAssignedBranches } from "../../actions/assigned-branches.action";
import { lastValueFrom } from "rxjs";
import { IBranch } from "@isms-core/interfaces";
import { BranchesService, NGRXService } from "@isms-core/services";

@Injectable({
  providedIn: "root",
})
export class AssignedBranchesStore {
  constructor(
    private readonly ngrxService: NGRXService,
    private readonly branchesService: BranchesService
  ) {}
  public update(data: Array<IBranch>): void {
    this.ngrxService.assignedBranchesStore.dispatch(new UpdateAssignedBranches(data));
  }

  public load(): void {
    lastValueFrom(this.branchesService.assignedBranches()).then((res) => {
      if (res.success) {
        this.update(res.data);
      }
    });
  }
}
