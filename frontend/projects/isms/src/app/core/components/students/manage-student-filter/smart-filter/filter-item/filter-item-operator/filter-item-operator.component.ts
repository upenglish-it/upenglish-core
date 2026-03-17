import { Component, Input, OnInit } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Animations } from "@isms-core/constants";
import { NgFor, NgIf } from "@angular/common";
import { NzSelectModule } from "ng-zorro-antd/select";

@Component({
  selector: "isms-filter-item-operator",
  templateUrl: "./filter-item-operator.component.html",
  animations: [Animations.down, Animations.default],
  imports: [NgIf, NgFor, ReactiveFormsModule, NzSelectModule],
})
export class FilterItemOperatorComponent implements OnInit {
  @Input("filter-form-group") filterFormGroup: FormGroup;

  public leadOperators = LEAD_OPERATORS;
  public branchOperators = BRANCH_OPERATORS;
  public statusOperators = STATUS_OPERATORS;
  public countryOperators = COUNTRY_OPERATORS;
  public genderOperators = GENDER_OPERATORS;
  public ageOperators = AGE_OPERATORS;

  public ngOnInit(): void {}

  public compareValue(value: any, compare: any): boolean {
    return value && compare ? value.name === compare.name : value === compare;
  }
}

export const BRANCH_OPERATORS = [
  {
    name: "Is In",
    value: "is-in",
  },
  {
    name: "Is Not In",
    value: "is-not-in",
  },
];

export const STATUS_OPERATORS = [
  {
    name: "Is",
    value: "is",
  },
  {
    name: "Is Not",
    value: "is-not",
  },
];

export const COUNTRY_OPERATORS = [
  {
    name: "Is",
    value: "is",
  },
  {
    name: "Is Not",
    value: "is-not",
  },
];

export const GENDER_OPERATORS = [
  {
    name: "Is",
    value: "is",
  },
  {
    name: "Is Not",
    value: "is-not",
  },
];

export const AGE_OPERATORS = [
  {
    name: "Equal",
    value: "equal",
  },
  {
    name: "Not Equal",
    value: "not-equal",
  },
  {
    name: "Less Than and Equal",
    value: "less-than-and-equal",
  },
  {
    name: "Greater Than and Equal",
    value: "greater-than-and-equal",
  },
];

export const LEAD_OPERATORS = [
  {
    name: "Is Lead",
    value: true,
  },
];
