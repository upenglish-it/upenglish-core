import { Component, Input, OnInit } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Animations } from "@isms-core/constants";
import { NgFor } from "@angular/common";
import { NzSelectModule } from "ng-zorro-antd/select";
import { distinctUntilChanged } from "rxjs";

@Component({
  selector: "isms-filter-item-parameter",
  templateUrl: "./filter-item-parameter.component.html",
  animations: [Animations.down, Animations.default],
  imports: [NgFor, ReactiveFormsModule, NzSelectModule],
})
export class FilterItemParameterComponent implements OnInit {
  @Input("filter-form-group") filterFormGroup: FormGroup;
  public parameters = PARAMETERS;

  public ngOnInit(): void {
    this.filterFormGroup
      .get("parameter")
      .valueChanges.pipe(distinctUntilChanged())
      .subscribe(() => this.filterFormGroup.get("value").setValue(null));
  }

  public compareValue(value: any, compare: any): boolean {
    return value && compare ? value.name === compare.name : value === compare;
  }
}

/* for up sms */
export const PARAMETERS = [
  {
    name: "Branch",
    value: "student/branch",
  },
  // {
  //   name: "Payment",
  //   value: "student/payment"
  // },
  {
    name: "Gender",
    value: "student/gender",
  },
  {
    name: "Age",
    value: "student/age",
  },
  {
    name: "Status",
    value: "student/status",
  },
  {
    name: "Country",
    value: "student/country",
  },
  {
    name: "Students",
    value: "student/lead",
  },
];
