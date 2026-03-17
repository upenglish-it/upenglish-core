import { Component, Input } from "@angular/core";
import { FormGroup } from "@angular/forms";

@Component({
  selector: "isms-manage-member-drawer",
  templateUrl: "./manage-member-drawer.component.html",
})
export class ManageMemberDrawerComponent {
  @Input("form-group") formGroup: FormGroup;
  public showDrawer: boolean = true;

  public toggle(): void {
    this.showDrawer = !this.showDrawer;
  }

  public onSubmit(): void {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.valid) {
      // Call API here
    }
    console.log(this.formGroup.valid);
    console.log(this.formGroup);
  }
}
