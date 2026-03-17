import { Component, Input } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { NzModalModule } from "ng-zorro-antd/modal";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzButtonModule } from "ng-zorro-antd/button";
import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NumberOnlyDirective } from "@isms-core/directives";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { TypeOfLabors } from "@isms-core/constants";
import { ManageStaffSalaryPackageModalComponent } from "../manage-staff-salary-package-modal/manage-staff-salary-package-modal.component";
import { FormattedCurrencyPipe } from "@isms-core/pipes";

@Component({
  selector: "isms-staff-salary-package-form",
  templateUrl: "./staff-salary-package-form.component.html",
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    NzDrawerModule,
    NzModalModule,
    NzButtonModule,
    NzInputModule,
    NzTagModule,
    NzSelectModule,
    NzIconModule,
    NzToolTipModule,
    NzDatePickerModule,
    NzInputModule,
    NzInputNumberModule,
  ],
})
export class StaffSalaryPackageFormComponent {
  @Input({ alias: "form-group", required: true }) formGroup: FormGroup;
  public readonly typeOfLabors = TypeOfLabors;

  // public computedInsuranceAmount = computed(() => {
  //   console.log("computed");
  //   const { employeePay, insuranceAmount, companyPay } = this.formGroup.getRawValue();
  //   return ((employeePay + companyPay) / 100) * insuranceAmount;
  // });

  public get computedInsuranceAmount(): number {
    // console.log("not computed");
    const { employeePay, insuranceAmount, companyPay } = this.formGroup.getRawValue();
    return ((employeePay + companyPay) / 100) * insuranceAmount;
  }
}
