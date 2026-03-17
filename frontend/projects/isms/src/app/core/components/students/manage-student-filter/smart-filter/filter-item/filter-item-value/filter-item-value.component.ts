import { NgFor, NgIf } from "@angular/common";
import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { Animations, Countries } from "@isms-core/constants";
import { NumberOnlyDirective } from "@isms-core/directives";
import { ICountry, INameValue } from "@isms-core/interfaces";
import { NGRXService } from "@isms-core/services";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzSelectModule } from "ng-zorro-antd/select";
import { SubSink } from "subsink";
@Component({
  selector: "isms-filter-item-value",
  templateUrl: "./filter-item-value.component.html",
  animations: [Animations.down, Animations.default],
  imports: [NgIf, NgFor, FormsModule, ReactiveFormsModule, NzSelectModule, NzInputModule, NumberOnlyDirective],
})
export class FilterItemValueComponent implements OnInit, OnDestroy {
  @Input("filter-form-group") filterFormGroup: FormGroup;
  private readonly subSink: SubSink = new SubSink();
  private selectedBranch: string = null;
  public branchValues: Array<INameValue> = [];
  public leadsValues: Array<INameValue> = LEADS_VALUES;
  public statusValues: Array<INameValue> = STATUS_VALUES;
  public countryValues: Array<INameValue> = [];
  public genderValues: Array<INameValue> = GENDER_VALUES;
  public ageValues: Array<INameValue> = AGE_VALUES;

  constructor(private readonly ngrxService: NGRXService) {
    this.subSink.add(
      this.ngrxService.branches().subscribe((res) => {
        this.branchValues = res.map((branch) => {
          return {
            name: branch.name,
            value: branch._id,
          };
        });
      })
    );
    this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));
  }

  public ngOnInit(): void {
    this.countryValues = Countries.map((country) => {
      return {
        name: country.name,
        value: country.code,
      };
    });
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  public compareValue(value: any, compare: any): boolean {
    return value && compare ? value.value === compare.value : value === compare;
  }

  public hideSelectedBranch(branchId: string): boolean {
    return ((this.filterFormGroup.value.value as Array<string>) || []).indexOf(branchId) >= 0;
  }
}
export const LEADS_VALUES = [
  { name: "Yes", value: true },
  { name: "No", value: false },
];

export const STATUS_VALUES = [
  { name: "Active", value: "active" },
  { name: "Inactive", value: "inactive" },
];

export const GENDER_VALUES = [
  { name: "Male", value: "male" },
  { name: "Female", value: "female" },
];

export const AGE_VALUES = [
  { name: "Active", value: "active" },
  { name: "Inactive", value: "inactive" },
];
