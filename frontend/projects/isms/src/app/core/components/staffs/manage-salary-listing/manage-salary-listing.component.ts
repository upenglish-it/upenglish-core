import { DatePipe, DecimalPipe, NgClass, NgFor, NgIf } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { EmploymentInformation, IAccount, StaffSalaryByDate, StaffSalaryPackage } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { NGRXService, StaffsService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { StaffInfoDrawerComponent } from "@isms-core/components/staffs/staff-info-drawer/staff-info-drawer.component";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { DateTime } from "luxon";
import { differenceInCalendarDays } from "date-fns";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { StaffSalaryAdvancementFormGroup, StaffSalaryFormGroup } from "@isms-core/form-group";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { FormattedCurrencyPipe } from "@isms-core/pipes";
import { NzSelectModule } from "ng-zorro-antd/select";
import { ManageSalaryAdvancementComponent } from "../manage-salary-advancement/manage-salary-advancement.component";

@Component({
  selector: "isms-manage-salary-listing",
  templateUrl: "./manage-salary-listing.component.html",
  imports: [
    NgClass,
    NgIf,
    NgFor,
    DecimalPipe,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    NzTagModule,
    NzInputModule,
    NzInputNumberModule,
    NzDropDownModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,

    NzSelectModule,
    ManageSalaryAdvancementComponent,
    ProfilePhotoDirective,
    FormattedCurrencyPipe,
  ],
})
export class ManageSalaryListingComponent {
  @ViewChild("staffInfoDrawer") staffInfoDrawer: StaffInfoDrawerComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  private staffs: Array<IAccount> = [];
  public filteredStaffs: Array<IAccount> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
    date: new FormControl(DateTime.now().toJSDate()),
  });

  public readonly staffSalaryFormGroup: FormGroup = StaffSalaryFormGroup();
  public readonly staffSalaryAdvancementFormGroup: FormGroup = StaffSalaryAdvancementFormGroup();
  public selectedStaffIndex: number = 0;

  public salaryPackage: StaffSalaryPackage = null;
  public employmentInformation: EmploymentInformation = null;
  public staffSalaryPayment: any = null;
  public salaryByDate: StaffSalaryByDate = null;

  public versionFormGroup = new FormGroup({
    selectedVersionId: new FormControl(null, Validators.required),
  });

  constructor(
    private readonly staffsService: StaffsService,
    private readonly ngrxService: NGRXService,
    private readonly nzNotificationService: NzNotificationService
  ) {
    this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));
  }

  public ngOnInit(): void {
    this.loadData();
    this.subSink.add(
      this.filterFormGroup
        .get("searchQuery")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe((value) => {
          this.filteredStaffs = this.find(this.staffs, value);
        })
    );
    this.subSink.add(
      this.filterFormGroup
        .get("date")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe(() => {
          this.loadSelectedStaff();
        })
    );
  }

  /* Temporary search filter. Refactor this later */
  private find(arr: any[], pat: string) {
    let pa = pat
      .trim()
      .replace(/ +/g, " ")
      .split(" ")
      .map((p: string | RegExp) => new RegExp(p, "i"));
    return arr.filter((n: { firstName: string; lastName: string }) => {
      let name = n.firstName + " " + n.lastName;
      return pa.every((p: { test: (arg0: string) => any }) => p.test(name));
    });
  }
  public async loadData(): Promise<void> {
    lastValueFrom(this.staffsService.fetch({ limit: 100 })).then((res) => {
      if (res.success) {
        this.setStudents(res.data);
        this.loadSelectedStaff();
      } else {
        this.resetStudents();
      }
    });
  }

  public loadSelectedStaff(): void {
    this.salaryPackage = null;
    this.employmentInformation = null;
    this.staffSalaryPayment = null;
    this.salaryByDate = null;
    this.staffSalaryFormGroup.reset();
    lastValueFrom(this.staffsService.fetchStaffSalaryById(this.filteredStaffs[this.selectedStaffIndex]._id, DateTime.fromJSDate(this.filterFormGroup.value.date).toISODate())).then(
      (res) => {
        if (res.success) {
          // staffWorkAccumulated,
          // classWorkAccumulated,
          // tutoringWorkAccumulated,
          // tapaWorkAccumulated,
          // {
          //   dailyRate?: number; // used in staff-work
          //   hourlyRate: number;
          //   workDaysWithSalary: Array<any>;
          //   originalSalary: number;
          //   totalSalary: number;
          //   totalWorkDays: number;
          //   unpaidHours: number;
          //   amountOfUnpaidHours: number;
          // }

          this.salaryPackage = res.data.salaryPackage;
          this.salaryByDate = res.data;
          // {
          //   ...res.data.salaryPackage
          //   // staffWorkTotalStaffSalary: res.data.staffWorkTotalStaffSalary,
          //   // staffWorkTotalStaffWorkDays: res.data.staffWorkTotalStaffWorkDays,
          //   // staffWorkDailyRate: res.data.staffWorkDailyRate,
          //   // staffWorkDaysInAMonthWithSalary: res.data.staffWorkDaysInAMonthWithSalary,
          //   // totalOfUnpaidHours: res.data.totalOfUnpaidHours,
          //   // totalAmountOfUnpaidHours: res.data.totalAmountOfUnpaidHours
          // };
          this.employmentInformation = res.data.employmentInformation;
          // this.staffSalary = res.data;

          const workStartDate = this.staffSalaryFormGroup.value.workStartDate
            ? DateTime.fromISO(this.staffSalaryFormGroup.value.workStartDate).toISODate()
            : DateTime.now().toJSDate();
          const workEndDate = this.staffSalaryFormGroup.value.workEndDate ? DateTime.fromISO(this.staffSalaryFormGroup.value.workEndDate).toISODate() : DateTime.now().toJSDate();

          this.staffSalaryFormGroup.reset({
            // _id: staffsSalaryPayment?._id || null,
            dateIssued: this.filterFormGroup.value.date,
            workDate: [workStartDate, workEndDate], // need  to concat
            absences: this.staffSalaryFormGroup.value.absences || 0,
            // basicSalary: this.salaryPackage.basicSalary,
            // dailySalary: this.salaryPackage.dailySalary,
            // consultingCommission: this.salaryPackage.consultingCommission,
            consultingCommissionQuantity: this.staffSalaryFormGroup.value.consultingCommissionQuantity || 0,
            // hourlyTeachingRate: this.salaryPackage.hourlyTeachingRate,
            hourlyTeachingRateQuantity: res.data.classWorkAccumulated.quantity,
            // hourlyTutoringRate: this.salaryPackage.hourlyTutoringRate,
            hourlyTutoringRateQuantity: res.data.tutoringWorkAccumulated.quantity, //this.staffSalaryFormGroup.value.hourlyTutoringRateQuantity || 0,
            // hourlyTAPARate: this.salaryPackage.hourlyTAPARate,
            hourlyTAPARateQuantity: res.data.tapaWorkAccumulated.quantity, //this.staffSalaryFormGroup.value.hourlyTAPARateQuantity || 0,
            addition: this.staffSalaryFormGroup.value.addition || 0,
            subtraction: this.staffSalaryFormGroup.value.subtraction || 0,
            // insuranceAmount: this.salaryPackage.insuranceAmount || 0,
            // employeePay: this.salaryPackage.employeePay,
            // companyPay: this.salaryPackage.companyPay
          });
        }
      }
    );
  }

  public onSelectStaff(index: number): void {
    this.selectedStaffIndex = index;
    this.loadSelectedStaff();
  }

  public onSubmitSalary(): void {
    this.staffSalaryFormGroup.markAllAsTouched();
    if (this.staffSalaryFormGroup.valid) {
      const payload = {
        dateIssued: DateTime.fromJSDate(this.filterFormGroup.value.date).toISODate(),
        workStartDate: DateTime.fromJSDate(this.staffSalaryFormGroup.value.workDate[0]).toISODate(),
        workEndDate: DateTime.fromJSDate(this.staffSalaryFormGroup.value.workDate[1]).toISODate(),
        absences: this.staffSalaryFormGroup.value.absences,
        consultingCommissionQuantity: this.staffSalaryFormGroup.value.consultingCommissionQuantity,
        hourlyTeachingRateQuantity: this.staffSalaryFormGroup.value.hourlyTeachingRateQuantity,
        hourlyTutoringRateQuantity: this.staffSalaryFormGroup.value.hourlyTutoringRateQuantity,
        hourlyTAPARateQuantity: this.staffSalaryFormGroup.value.hourlyTAPARateQuantity,
        addition: this.staffSalaryFormGroup.value.addition,
        subtraction: this.staffSalaryFormGroup.value.subtraction,
        totalStaffSalary: this.totalAmount,
        ...(this.staffSalaryAdvancementFormGroup.value.payNow
          ? {
              salaryAdvancementId: this.staffSalaryAdvancementFormGroup.value._id,
              salaryAdvancementAmountToPay: this.staffSalaryAdvancementFormGroup.value.agreement.amount,
              salaryAdvancementBalance: this.staffSalaryAdvancementFormGroup.value.remainingBalance,
            }
          : null),
        // totalOfUnpaidHours: this.salaryPackage.totalOfUnpaidHours,
        // totalAmountOfUnpaidHours: this.salaryPackage.totalAmountOfUnpaidHours
      };
      lastValueFrom(this.staffsService.setSalaryByDate(this.filteredStaffs[this.selectedStaffIndex]._id, payload)).then((res) => {
        // if (res.success) {
        //   this.staffSalaryFormGroup.get("_id").setValue(res.data._id);
        // }
        this.nzNotificationService.create(res.success ? "success" : "error", "Salary Confirmation", res.message);

        this.onSelectStaff(this.selectedStaffIndex);
      });
    }
  }

  public identify = (index: number, item: IAccount) => {
    return item._id;
  };

  public revertVersion(): void {
    lastValueFrom(
      this.staffsService.removeSalaryByDate(this.filteredStaffs[this.selectedStaffIndex]._id, {
        salaryPaymentId: this.salaryByDate.staffSalaryPayment._id, //this.staffSalary._id
      })
    ).then((res) => {
      // if (res.success) {
      //   this.staffSalaryFormGroup.get("_id").setValue(res.data._id);
      // }
      this.nzNotificationService.create(res.success ? "success" : "error", "Revert Salary", res.message);

      this.onSelectStaff(this.selectedStaffIndex);
    });
  }

  private setStudents(students: Array<IAccount>): void {
    const mappedStudents = students.map((student) => {
      student["selected"] = false;
      return student;
    });
    this.staffs = mappedStudents;
    this.filteredStaffs = mappedStudents;
  }

  private resetStudents(): void {
    this.staffs = [];
    this.filteredStaffs = [];
  }

  // public onChangeSegmentSelector(index: number): void {
  //   this.segmentIndex = index;
  // }

  public disabledPreviousDate = (current: Date): boolean => differenceInCalendarDays(current, DateTime.now().toJSDate()) > 0;

  public get selectedStudents(): Array<string> {
    return this.staffs.filter((staff) => staff.selected).map((s) => s._id) || [];
  }

  public get computedInsuranceAmount(): number {
    const insuranceAmount = this.salaryPackage.insuranceAmount;
    const companyPay = this.salaryPackage.companyPay;
    const employeePay = this.salaryPackage.employeePay;
    return ((companyPay + employeePay) / 100) * insuranceAmount;
  }

  public get totalAmount(): number {
    const absences = this.salaryByDate.staffWorkAccumulated.dailyRate * this.staffSalaryFormGroup.value.absences;
    const basicSalary = this.salaryByDate.staffWorkAccumulated.totalSalary - absences;

    const consultingCommissionTotal = this.salaryPackage.consultingCommission * this.staffSalaryFormGroup.value.consultingCommissionQuantity;
    const hourlyTeachingRateTotal = this.salaryPackage.hourlyTeachingRate * this.staffSalaryFormGroup.value.hourlyTeachingRateQuantity;
    const hourlyTutoringRateTotal = this.salaryPackage.hourlyTutoringRate * this.staffSalaryFormGroup.value.hourlyTutoringRateQuantity;
    const hourlyTAPARateTotal = this.salaryPackage.hourlyTAPARate * this.staffSalaryFormGroup.value.hourlyTAPARateQuantity;

    const addition = this.staffSalaryFormGroup.value.addition;
    const subtraction = this.staffSalaryFormGroup.value.subtraction;

    let total = basicSalary + consultingCommissionTotal + hourlyTeachingRateTotal + hourlyTutoringRateTotal + hourlyTAPARateTotal + addition;

    total = total - subtraction;

    // deduct salary advancement
    if (this.staffSalaryAdvancementFormGroup.value.payNow) {
      total = total - this.staffSalaryAdvancementFormGroup.value.agreement.amount;
    }

    return total - this.computedInsuranceAmount;
  }
}
