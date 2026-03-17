/* eslint-disable no-unused-vars */
import { Injectable, inject } from "@angular/core";
import { UpdateSelectedBranch } from "../../actions/selected-branch.action";
import { LocalStorageKeys } from "@isms-core/constants";
import { lastValueFrom } from "rxjs";
import { BranchesService, LocalStorageService, NGRXService } from "@isms-core/services";

@Injectable({
  providedIn: "root",
})
export class SelectedBranchStore {
  // private nzNotificationService: NzNotificationService = null;
  constructor(
    private readonly ngrxService: NGRXService,
    private readonly localStorageService: LocalStorageService,
    private readonly branchesService: BranchesService // private readonly nzNotificationService: NzNotificationService
  ) {
    // this.nzNotificationService = inject(NzNotificationService);
  }
  public update(data: string): void {
    this.ngrxService.selectedBranchesStore.dispatch(new UpdateSelectedBranch(data));
  }

  public switch(branchId: string): void {
    lastValueFrom(this.branchesService.switch({ branchId: branchId })).then((res) => {
      if (res.success) {
        this.localStorageService.set(LocalStorageKeys.AUTHORIZATION, res.data.authorizationToken);
        this.ngrxService.selectedBranchesStore.dispatch(new UpdateSelectedBranch(res.data.selectedBranch));
        // this.nzNotificationService.success("Select Branch", res.message);
        setInterval(() => {
          location.reload();
        }, 500);
      } else {
        // this.nzNotificationService.error("Select Branch", res.message);
      }
    });
  }
}
