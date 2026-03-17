import { Component, OnDestroy } from "@angular/core";
import { WorkspaceNavigation, AccountNavigation, SystemSettingsNavigation } from "./data";
import { INavigation } from "@isms-pages/inner/layout/data";
import { IBranch } from "@isms-core/interfaces";
import { NGRXService } from "@isms-core/services";
import { SubSink } from "subsink";

@Component({
  selector: "layout",
  templateUrl: "./layout.component.html",
  styleUrls: ["./layout.component.scss"],
  standalone: false,
})
export class LayoutComponent implements OnDestroy {
  private subSink: SubSink = new SubSink();
  public workspaceNavigation: Array<INavigation> = WorkspaceNavigation;
  public accountNavigation: Array<INavigation> = AccountNavigation;
  public systemSettingsNavigation: Array<INavigation> = SystemSettingsNavigation;
  public branches: Array<IBranch> = [];
  public selectedBranch: string = null;

  constructor(private readonly ngrxService: NGRXService) {
    this.subSink.add(this.ngrxService.branches().subscribe((res) => (this.branches = res)));
    this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  public get selectedBranchInfo(): IBranch {
    return this.branches.find((b) => b._id === this.selectedBranch);
  }
}
