import { Component, Input, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";

@Component({
  selector: "section-container",
  templateUrl: "./section-container.component.html",
})
export class SectionContainerComponent implements OnInit {
  @Input("form-group") formGroup: FormGroup;

  public ngOnInit(): void {}

  public toggleExpand(): void {
    const expand = this.formGroup.get("expand").value;
    this.formGroup.get("expand").setValue(!expand);
  }

  public get setupFormGroup(): FormGroup {
    return this.formGroup.get("setup") as FormGroup;
  }

  public get availabilityFormGroup(): FormGroup {
    return this.formGroup.get("availability") as FormGroup;
  }

  public get teamMemberFormGroup(): FormGroup {
    return this.formGroup.get("teamMember") as FormGroup;
  }

  public get reminderFormGroup(): FormGroup {
    return this.formGroup.get("reminder") as FormGroup;
  }

  public get confirmationFormGroup(): FormGroup {
    return this.formGroup.get("confirmation") as FormGroup;
  }

  public availabilityScheduleFormGroup(): FormGroup {
    return this.formGroup.get("schedule") as FormGroup;
  }
}
