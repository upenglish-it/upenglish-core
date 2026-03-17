import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { EmploymentInformation, IAccount, StaffSalaryPackage } from "@isms-core/interfaces";
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
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { TypeOfLabors } from "@isms-core/constants";
import { ManageStaffSalaryPackageModalComponent } from "../manage-staff-salary-package-modal/manage-staff-salary-package-modal.component";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { FormattedCurrencyPipe } from "@isms-core/pipes";
import { SubSink } from "subsink";
import { StaffSalaryPackageFormGroup } from "@isms-core/form-group";
import { StaffSalaryPackageFormComponent } from "../staff-salary-package-form/staff-salary-package-form.component";
import { DateTime } from "luxon";
import { isEmpty } from "lodash";

@Component({
  selector: "isms-staff-salary-package-selector",
  templateUrl: "./staff-salary-package-selector.component.html",
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
    FormattedCurrencyPipe,
    ManageStaffSalaryPackageModalComponent,
    StaffSalaryPackageFormComponent,
  ],
})
export class StaffSalaryPackageSelectorComponent implements OnInit, OnDestroy {
  @Output("on-submitted") onSubmitted: EventEmitter<void> = new EventEmitter();
  @Input({ alias: "staff-id", required: true }) staffId: string;
  private subSink: SubSink = new SubSink();
  public readonly typeOfLabors = TypeOfLabors;
  public salaryPackages: Array<StaffSalaryPackage> = [];
  public employmentInformation: EmploymentInformation = null;
  public assignedSalaryPackage: StaffSalaryPackage = null;
  public showModal: boolean = false;
  public employmentInformationFormGroup: FormGroup = new FormGroup({
    salaryPackageId: new FormControl(null),
    dateHired: new FormControl(new Date()),
    salaryIncrease: new FormGroup({
      count: new FormControl(1),
      type: new FormControl("year"),
    }),
  });
  public salaryPackageFormGroup: FormGroup = StaffSalaryPackageFormGroup();
  public salaryCounts = Array.from({ length: 31 }, (value, index) => index + 1);

  constructor(
    private readonly staffsService: StaffsService,
    private readonly nzNotificationService: NzNotificationService,
    private readonly ngrxService: NGRXService
  ) {}

  public ngOnInit(): void {
    this.subSink.add(
      this.employmentInformationFormGroup
        .get("salaryPackageId")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe((salaryPackageId: string) => {
          lastValueFrom(this.staffsService.fetchSalaryPackageById(this.staffId, salaryPackageId)).then((res) => {
            if (res.success) {
              const salaryPackage: StaffSalaryPackage = res.data;
              this.salaryPackageFormGroup.reset({
                _id: { value: salaryPackage._id, disabled: true },
                name: { value: salaryPackage.name, disabled: true },
                jobTitle: { value: salaryPackage.jobTitle, disabled: true },
                typeOfLabor: { value: salaryPackage.typeOfLabor, disabled: true },
                basicSalary: { value: salaryPackage.basicSalary, disabled: true },
                dailySalary: { value: salaryPackage.dailySalary, disabled: true },
                consultingCommission: { value: salaryPackage.consultingCommission, disabled: true },
                hourlyTeachingRate: { value: salaryPackage.hourlyTeachingRate, disabled: true },
                hourlyTutoringRate: { value: salaryPackage.hourlyTutoringRate, disabled: true },
                hourlyTAPARate: { value: salaryPackage.hourlyTAPARate, disabled: true },
                insuranceAmount: { value: salaryPackage.insuranceAmount, disabled: true },
                employeePay: { value: salaryPackage.employeePay, disabled: true },
                companyPay: { value: salaryPackage.companyPay, disabled: true },
              });
            }
          });
        }),
      this.employmentInformationFormGroup
        .get("dateHired")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe((dateHired: Date) => {
          lastValueFrom(this.staffsService.updateEmployeeInformation(this.staffId, { dateHired: DateTime.fromJSDate(dateHired).toISODate() })).then((res) => {
            if (res.success) {
              this.nzNotificationService.create(res.success ? "success" : "error", "Update Date Hired", res.message, { nzPlacement: "bottomRight" });
            }
          });
        })
    );
    this.loadData();
  }

  public ngOnDestroy(): void {}

  public loadData(): void {
    lastValueFrom(this.staffsService.fetchSalaryPackages(this.staffId)).then((res) => {
      console.log("ress >", res);
      this.salaryPackages = res.success ? res.data : [];
    });
    this.loadAssignedSalaryPackageData();
  }

  public loadAssignedSalaryPackageData(): void {
    lastValueFrom(this.staffsService.assignedSalaryPackage(this.staffId)).then((res) => {
      this.employmentInformation = null;
      this.assignedSalaryPackage = null;
      if (res.success) {
        this.employmentInformation = res.data.employmentInformation;
        this.assignedSalaryPackage = res.data.salaryPackage;
        this.employmentInformationFormGroup.get("salaryPackageId").setValue(this.employmentInformation.salaryPackageId);
        this.employmentInformationFormGroup
          .get("dateHired")
          .setValue(isEmpty(this.employmentInformation.dateHired) ? null : DateTime.fromISO(this.employmentInformation.dateHired).toJSDate(), { emitEvent: false });
        this.employmentInformationFormGroup.get("salaryIncrease").get("count").setValue(this.employmentInformation.salaryIncrease.count, { emitEvent: false });
        this.employmentInformationFormGroup.get("salaryIncrease").get("type").setValue(this.employmentInformation.salaryIncrease.type, { emitEvent: false });
      }
    });
  }

  public assignSalaryPackage(): void {
    lastValueFrom(
      this.staffsService.assignSalaryPackage(this.staffId, {
        salaryPackageId: this.employmentInformationFormGroup.value.salaryPackageId,
      })
    ).then((res) => {
      console.log("assignSalaryPackage >", res);
      this.loadAssignedSalaryPackageData();
    });
  }

  public updateSalaryIncrease(): void {
    lastValueFrom(this.staffsService.updateSalaryIncrease(this.staffId, this.employmentInformationFormGroup.value.salaryIncrease)).then((res) => {
      if (res.success) {
        this.nzNotificationService.create(res.success ? "success" : "error", "Update Salary Increase", res.message, { nzPlacement: "bottomRight" });
        this.employmentInformationFormGroup.get("salaryIncrease").markAllAsTouched();
      }
    });
  }

  public toggle(): void {
    this.showModal = !this.showModal;
  }

  public toFormGroup(formGroup: AbstractControl): FormGroup {
    return formGroup as FormGroup;
  }
}
