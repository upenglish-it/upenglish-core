import { Component, Input } from "@angular/core";
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { Animations } from "@isms-core/constants";
import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { FilterItemParameterComponent, PARAMETERS } from "./filter-item-parameter/filter-item-parameter.component";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { FilterItemOperatorComponent } from "./filter-item-operator/filter-item-operator.component";
import { FilterItemValueComponent } from "./filter-item-value/filter-item-value.component";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzIconModule } from "ng-zorro-antd/icon";

@Component({
  selector: "isms-filter-item",
  templateUrl: "./filter-item.component.html",
  animations: [Animations.default, Animations.down],
  imports: [
    NgFor,
    NgIf,
    ReactiveFormsModule,
    JsonPipe,
    NzDropDownModule,
    FilterItemParameterComponent,
    FilterItemOperatorComponent,
    FilterItemValueComponent,
    NzButtonModule,
    NzPopconfirmModule,
    NzIconModule,
  ],
})
export class FilterItemComponent {
  @Input("filter-form-group") filterFormGroup: FormGroup;
  // @Input("trigger-form-array") triggerFormArray: FormArray;
  // @Input("trigger-form-array-index") triggerFormArrayIndex: number;

  public sequenceOperators = [
    { value: "or", name: "Or" },
    { value: "and", name: "And" },
  ];

  constructor(private nzNotificationService: NzNotificationService) {}

  // public compareSequenceOperatorValue(value: any, compare: any): boolean {
  //   return value && compare ? value.name === compare.name : value === compare;
  // }

  public get filterFormArray(): FormArray {
    return this.filterFormGroup.get("filters") as FormArray;
  }

  // public get triggerValueFormGroup(): FormGroup {
  //   return this.triggerFormArray.get("value") as FormGroup;
  // }

  public toFormGroup(form: AbstractControl): FormGroup {
    return form as FormGroup;
  }

  public removeFilterFormGroup(index: number): void {
    // If deleting the first index then remove the sequence operator of next filter condition
    if (index === 0) {
      this.filterFormArray.controls[index + 1].get("sequenceOperator").setValue(null);
    }
    this.filterFormArray.removeAt(index);
  }

  public addTriggerFilter(sequenceOperator: { value: string; name: string }): void {
    let sequenceOperatorValue = sequenceOperator;
    if (this.filterFormArray.length === 0) {
      sequenceOperatorValue = null;
    }

    this.filterFormArray.push(
      new FormGroup({
        parameter: new FormControl(PARAMETERS[0], [Validators.required]),
        operator: new FormControl(null, [Validators.required]),
        value: new FormControl(null, [Validators.required]),
        sequenceOperator: new FormControl(sequenceOperatorValue),
      })
    );

    //   const triggerType = this.triggerFormArray.controls[this.triggerFormArrayIndex].value.type;
    //   if (triggerType === "contact-tag") {
    //     this.triggerFilterConditionFormArray.push(
    //       new FormGroup({
    //         parameter: new FormControl(CONTACT_TAG_PARAMETER[0], [Validators.required]),
    //         operator: new FormControl([], [Validators.required]),
    //         value: new FormControl([], [Validators.required]),
    //         sequenceOperator: new FormControl(sequenceOperator, [Validators.required])
    //       })
    //     );
    //   }
    //   if (triggerType === "contact-dnd") {
    //     this.triggerFilterConditionFormArray.push(
    //       new FormGroup({
    //         parameter: new FormControl(CONTACT_DND_STATUS_PARAMETER[0], [Validators.required]),
    //         operator: new FormControl([], [Validators.required]),
    //         value: new FormControl([], [Validators.required]),
    //         sequenceOperator: new FormControl(sequenceOperator, [Validators.required])
    //       })
    //     );
    //   }
    //   if (triggerType === "contact-created") {
    //     this.triggerFilterConditionFormArray.push(
    //       new FormGroup({
    //         parameter: new FormControl(CONTACT_CREATED_PARAMETER[0], [Validators.required]),
    //         operator: new FormControl([], [Validators.required]),
    //         value: new FormControl([], [Validators.required]),
    //         sequenceOperator: new FormControl(sequenceOperator, [Validators.required])
    //       })
    //     );
    //   }
    //   if (triggerType === "contact-updated") {
    //     this.triggerFilterConditionFormArray.push(
    //       new FormGroup({
    //         parameter: new FormControl(CONTACT_UPDATED_PARAMETER[0], [Validators.required]),
    //         operator: new FormControl([], [Validators.required]),
    //         value: new FormControl([], [Validators.required]),
    //         sequenceOperator: new FormControl(sequenceOperator, [Validators.required])
    //       })
    //     );
    //   }
    //   if (triggerType === "contact-replied") {
    //     this.triggerFilterConditionFormArray.push(
    //       new FormGroup({
    //         parameter: new FormControl(CONTACT_REPLIED_PARAMETER[0], [Validators.required]),
    //         operator: new FormControl([], [Validators.required]),
    //         value: new FormControl([], [Validators.required]),
    //         sequenceOperator: new FormControl(sequenceOperator, [Validators.required])
    //       })
    //     );
    //   }
    //   if (triggerType === "appointment") {
    //     this.triggerFilterConditionFormArray.push(
    //       new FormGroup({
    //         parameter: new FormControl([APPOINTMENT_PARAMETER[0].value], [Validators.required]),
    //         operator: new FormControl([], [Validators.required]),
    //         value: new FormControl([], [Validators.required]),
    //         sequenceOperator: new FormControl(sequenceOperator, [Validators.required])
    //       })
    //     );
    //   }
    //   if (triggerType === "pipeline-stage-updated") {
    //     this.triggerFilterConditionFormArray.push(
    //       new FormGroup({
    //         parameter: new FormControl(PIPELINE_STAGE_UPDATED_PARAMETER[0], [Validators.required]),
    //         operator: new FormControl(IN_PIPELINE_OPERATOR[0], [Validators.required]),
    //         value: new FormControl(null, [Validators.required]),
    //         sequenceOperator: new FormControl(sequenceOperator, [Validators.required])
    //       })
    //     );
    //   }
    //   if (triggerType === "deal-created") {
    //     this.triggerFilterConditionFormArray.push(
    //       new FormGroup({
    //         parameter: new FormControl(DEAL_CREATED_PARAMETER[0], [Validators.required]),
    //         operator: new FormControl(IN_PIPELINE_OPERATOR[0], [Validators.required]),
    //         value: new FormControl(null, [Validators.required]),
    //         sequenceOperator: new FormControl(sequenceOperator, [Validators.required])
    //       })
    //     );
    //   }
  }

  public hideOperator(parameterValue: string): boolean {
    if (
      parameterValue === "contact-updated/in-automation" ||
      parameterValue === "contact-dnd/dnd-status" ||
      parameterValue === "contact-replied/to-automation" ||
      parameterValue === "deal-and-pipeline/in-pipeline" ||
      parameterValue === "deal-and-pipeline/pipeline-stage"
    ) {
      return false;
    }
    return true;
  }
}
