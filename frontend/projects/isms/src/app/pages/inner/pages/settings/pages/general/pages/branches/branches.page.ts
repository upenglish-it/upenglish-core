import { Component, OnInit, ViewChild } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ManageBranchModalComponent } from "@isms-core/components/settings/general/manage-branch-modal/manage-branch-modal.component";
import { IBranch } from "@isms-core/interfaces";
import { BranchesStore, SelectedBranchStore } from "@isms-core/ngrx";
import { BranchesService, NGRXService } from "@isms-core/services";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { Animations } from "@isms-core/constants";
import { lastValueFrom } from "rxjs";
import { SubSink } from "subsink";

@Component({
  templateUrl: "./branches.page.html",
  animations: [Animations.down],
  standalone: false,
})
export class BranchesPage implements OnInit {
  @ViewChild("manageBranchModal") manageBranchModal: ManageBranchModalComponent;

  public branches: IBranch[] = [
    // {
    //   name: "Sunrise Elementary School",
    //   logo: "https://example.com/sunrise-logo.png",
    //   address: "123 Main Street, Cityville"
    // },
    // {
    //   name: "Maplewood Middle School",
    //   logo: "https://example.com/maplewood-logo.png",
    //   address: "456 Elm Avenue, Townsville"
    // },
    // {
    //   name: "Oakridge High School",
    //   logo: "https://example.com/oakridge-logo.png",
    //   address: "789 Oak Lane, Villageton"
    // },
    // {
    //   name: "Meadowbrook Academy",
    //   logo: "https://example.com/meadowbrook-logo.png",
    //   address: "321 Meadow Road, Countryside"
    // },
    // {
    //   name: "Cedarwood Preparatory",
    //   logo: "https://example.com/cedarwood-logo.png",
    //   address: "567 Cedar Drive, Suburbia"
    // }
  ];

  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;

  public manageBranchFormGroup: FormGroup = new FormGroup({
    _id: new FormControl(null),
    name: new FormControl(null, [Validators.required]),
    address: new FormControl(null, [Validators.required]),
  });

  constructor(
    private readonly ngrxService: NGRXService,
    private readonly branchesService: BranchesService,
    private readonly branchesStore: BranchesStore,
    private readonly selectedBranchStore: SelectedBranchStore,
    private readonly nzNotificationService: NzNotificationService
  ) {
    this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));
  }

  public ngOnInit(): void {
    this.loadData();
  }

  public loadData(): void {
    lastValueFrom(this.branchesService.fetch()).then((res) => {
      this.branches = res.success ? res.data : [];
    });
  }

  public onEdit(branch: IBranch): void {
    this.manageBranchModal.toggle();
    this.manageBranchFormGroup.get("_id").setValue(branch._id);
    this.manageBranchFormGroup.get("name").setValue(branch.name);
    this.manageBranchFormGroup.get("address").setValue(branch.address);
    this.branchesStore.load();
  }

  public onSetAsSelected(branch: IBranch): void {
    this.selectedBranchStore.switch(branch._id);
  }

  public onSetToInactive(branch: IBranch): void {
    if (branch.deleted) {
      lastValueFrom(this.branchesService.undo(branch._id)).then((res) => {
        this.loadData();
        this.branchesStore.load();
        this.nzNotificationService.success("Recover Branch", res.message);
      });
    } else {
      lastValueFrom(this.branchesService.delete(branch._id)).then((res) => {
        this.loadData();
        this.branchesStore.load();
        this.nzNotificationService.success("Delete Branch", res.message);
      });
    }
  }
}
