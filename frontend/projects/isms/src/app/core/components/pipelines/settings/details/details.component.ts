import { NgFor, NgIf } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NgxTinymceModule } from "ngx-tinymce";
import { differenceInCalendarDays } from "date-fns";
import { DateTime } from "luxon";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";

@Component({
  selector: "isms-pipeline-details",
  templateUrl: "./details.component.html",
  imports: [NgIf, NgFor, ReactiveFormsModule, NzSelectModule, NzInputModule, NzInputNumberModule, NzDatePickerModule, NzSwitchModule, NzToolTipModule, NgxTinymceModule],
})
export class PipelineDetailsComponent {
  @Input("form-group") formGroup: FormGroup;

  public disabledPreviousDate = (current: Date): boolean => differenceInCalendarDays(current, DateTime.now().toJSDate()) < 0;

  public get locationFormGroup(): FormGroup {
    return this.formGroup.get("location") as FormGroup;
  }

  public get employmentFormGroup(): FormGroup {
    return this.formGroup.get("employment") as FormGroup;
  }
}
