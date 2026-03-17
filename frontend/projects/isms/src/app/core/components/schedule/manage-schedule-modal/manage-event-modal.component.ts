import { NgFor, NgIf } from "@angular/common";
import { Component } from "@angular/core";
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MembersSelectorComponent } from "@isms-core/components/common/members-selector/members-selector.component";
import { ScheduleSelectorComponent } from "@isms-core/components/common/schedule-selector/schedule-selector.component";
import { ScheduleFormGroup } from "@isms-core/form-group";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";

@Component({
  selector: "isms-manage-event-modal",
  templateUrl: "./manage-event-modal.component.html",
  standalone: true,
  imports: [NgIf, NgFor, ReactiveFormsModule, NzModalModule, NzButtonModule, NzInputModule, ScheduleSelectorComponent, MembersSelectorComponent],
})
export class ManageEventModalComponent {
  public eventFormGroup = new FormGroup({
    title: new FormControl(null, Validators.required),
    attendees: new FormArray([]),
    location: new FormControl(null),
    description: new FormControl(null),
    schedule: ScheduleFormGroup(),
  });
  public showModal: boolean = true;
  public loading: boolean = false;

  public toggle(): void {
    this.showModal = !this.showModal;
  }

  public get scheduleFormGroup(): FormGroup {
    return this.eventFormGroup.get("schedule") as FormGroup;
  }
}
