import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { Component } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ScheduleSelectorComponent } from "@isms-core/components/common/schedule-selector/schedule-selector.component";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { ScheduleFormGroup } from "@isms-core/form-group";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzInputModule } from "ng-zorro-antd/input";

@Component({
  selector: "isms-schedule-listing",
  templateUrl: "./schedule-listing.component.html",
  standalone: true,
  imports: [NgIf, NgFor, JsonPipe, ReactiveFormsModule, NzDrawerModule, NzButtonModule, NzInputModule, ScheduleSelectorComponent, ProfilePhotoDirective],
})
export class ManageStaffScheduleDrawerComponent {
  public staffScheduleFormGroup = new FormGroup({
    title: new FormControl(null, Validators.required),
    schedule: ScheduleFormGroup(),
  });
  public showDrawer: boolean = false;
  public loading: boolean = false;

  public toggle(): void {
    this.showDrawer = !this.showDrawer;
  }

  public get scheduleFormGroup(): FormGroup {
    return this.staffScheduleFormGroup.get("schedule") as FormGroup;
  }
}
