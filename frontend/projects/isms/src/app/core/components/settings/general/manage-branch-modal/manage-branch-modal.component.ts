import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { BranchesService } from "@isms-core/services";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { lastValueFrom } from "rxjs";

@Component({
  selector: "isms-manage-branch-modal",
  templateUrl: "./manage-branch-modal.component.html",
  imports: [ReactiveFormsModule, NzModalModule, NzInputModule, NzButtonModule],
})
export class ManageBranchModalComponent {
  @Output("on-saved") onSaved: EventEmitter<void> = new EventEmitter<void>();
  @Input("form-group") formGroup: FormGroup;

  public showDrawer: boolean = false;

  constructor(
    private readonly branchesService: BranchesService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public toggle(): void {
    this.showDrawer = !this.showDrawer;
    if (this.showDrawer) {
      this.formGroup.reset();
    }
  }

  public onSubmit(): void {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.valid) {
      if (this.formGroup.value._id) {
        lastValueFrom(this.branchesService.update({ name: this.formGroup.value.name, address: this.formGroup.value.address }, this.formGroup.value._id)).then((res) => {
          if (res.success) {
            this.toggle();
            this.onSaved.emit();
            this.nzNotificationService.success("Update Branch", res.message);
          } else {
            this.nzNotificationService.error("Update Branch", res.message);
          }
        });
      } else {
        lastValueFrom(this.branchesService.create({ name: this.formGroup.value.name, address: this.formGroup.value.address })).then((res) => {
          if (res.success) {
            this.toggle();
            this.onSaved.emit();
            this.nzNotificationService.success("Create Branch", res.message);
          } else {
            this.nzNotificationService.error("Create Branch", res.message);
          }
        });
      }
    }
  }
}
