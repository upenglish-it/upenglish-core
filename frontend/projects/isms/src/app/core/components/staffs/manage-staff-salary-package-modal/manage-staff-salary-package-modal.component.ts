import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { IAccount, StaffSalaryPackage } from "@isms-core/interfaces";
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
import { NGRXService, StaffsService } from "@isms-core/services";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { StaffPersonalInfoFormGroup, StaffSalaryPackageFormGroup } from "@isms-core/form-group";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { TypeOfLabors } from "@isms-core/constants";
import { lastValueFrom } from "rxjs";
import { StaffSalaryPackageFormComponent } from "../staff-salary-package-form/staff-salary-package-form.component";
import { isEmpty } from "lodash";

@Component({
  selector: "isms-manage-staff-salary-package-modal",
  templateUrl: "./manage-staff-salary-package-modal.component.html",
  imports: [
    NgIf,
    NgFor,
    JsonPipe,
    ReactiveFormsModule,
    SegmentedSelectorComponent,
    NumberOnlyDirective,
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
    StaffSalaryPackageFormComponent,
  ],
})
export class ManageStaffSalaryPackageModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") onSubmitted: EventEmitter<void> = new EventEmitter();
  @Input({ alias: "staff-id", required: true }) staffId: string;
  public showModal: boolean = false;

  public salaryPackageFormGroup: FormGroup = StaffSalaryPackageFormGroup();

  constructor(
    private readonly staffsService: StaffsService,
    private readonly nzNotificationService: NzNotificationService,
    private readonly ngrxService: NGRXService
  ) {}

  public ngOnInit(): void {}

  public ngOnDestroy(): void {}

  public toggle(): void {
    this.salaryPackageFormGroup.reset();
    this.showModal = !this.showModal;
  }

  public manage(salaryPackageId: string): void {
    lastValueFrom(this.staffsService.fetchSalaryPackageById(this.staffId, salaryPackageId)).then((res) => {
      if (res.success) {
        const salaryPackage: StaffSalaryPackage = res.data;
        this.salaryPackageFormGroup.reset({
          // dateIssued: new FormControl(null),

          // jobTitle: new FormControl(null, Validators.required),
          // // workSchedule: new FormControl(null, Validators.required),

          // name: new FormControl(null, Validators.required),
          // typeOfLabor: new FormControl(null, Validators.required),

          // // workDate: new FormControl(null, Validators.required),

          // // absences: new FormControl(0, Validators.required),
          // basicSalary: new FormControl(null, Validators.required),
          // dailySalary: new FormControl(null, Validators.required),

          // consultingCommission: new FormControl(null, Validators.required),
          // hourlyTeachingRate: new FormControl(null, Validators.required),
          // hourlyTutoringRate: new FormControl(null, Validators.required),
          // hourlyTAPARate: new FormControl(null, Validators.required),

          // insuranceAmount: new FormControl(null, Validators.required),
          // employeePay: new FormControl(null, Validators.required),
          //       companyPay: new FormControl(null, Validators.required)

          _id: salaryPackage._id || null,
          name: salaryPackage.name,
          jobTitle: salaryPackage.jobTitle,
          typeOfLabor: salaryPackage.typeOfLabor,

          basicSalary: salaryPackage.basicSalary,
          dailySalary: salaryPackage.dailySalary,
          consultingCommission: salaryPackage.consultingCommission,
          hourlyTeachingRate: salaryPackage.hourlyTeachingRate,
          hourlyTutoringRate: salaryPackage.hourlyTutoringRate,
          hourlyTAPARate: salaryPackage.hourlyTAPARate,
          insuranceAmount: salaryPackage.insuranceAmount,
          employeePay: salaryPackage.employeePay,
          companyPay: salaryPackage.companyPay,
        });
        this.showModal = true;
      }
    });
  }

  public onSubmit(): void {
    console.log(">>>", this.staffId, this.salaryPackageFormGroup.value);
    this.salaryPackageFormGroup.markAllAsTouched();

    if (!isEmpty(this.salaryPackageFormGroup.value._id)) {
      if (this.salaryPackageFormGroup.valid) {
        lastValueFrom(this.staffsService.updateSalaryPackage(this.staffId, this.salaryPackageFormGroup.value._id, { ...this.salaryPackageFormGroup.value })).then((res) => {
          console.log("res", res);
          this.toggle();
          this.onSubmitted.emit();
        });
      } else {
        this.nzNotificationService.error("Update Salary Package", "Unable to create");
      }
    } else {
      if (this.salaryPackageFormGroup.valid) {
        lastValueFrom(this.staffsService.createSalaryPackage(this.staffId, { ...this.salaryPackageFormGroup.value })).then((res) => {
          console.log("res", res);
          this.toggle();
          this.onSubmitted.emit();
        });
      } else {
        this.nzNotificationService.error("Create Salary Package", "Unable to create");
      }
    }
  }

  public get computedInsuranceAmount(): number {
    const insuranceAmount = this.salaryPackageFormGroup.value.insuranceAmount;
    const employeePay = this.salaryPackageFormGroup.value.employeePay;
    const companyPay = this.salaryPackageFormGroup.value.companyPay;
    return ((employeePay + companyPay) / 100) * insuranceAmount;
  }
}
