import { DatePipe, JsonPipe, NgClass, NgFor, NgIf, NgStyle } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { Countries, EmailValidatorPattern, Positions, Roles, Timezones, TypeOfLabors, WorkSchedules } from "@isms-core/constants";
import { NumberCountries } from "@isms-core/constants/src/number-countries.constant";
import { NumberOnlyDirective } from "@isms-core/directives";
import { StaffEmploymentSettingsFormGroup, StaffPersonalInfoFormGroup, StaffSalaryAdvancementFormGroup } from "@isms-core/form-group";
import {
  IAccount,
  IBranch,
  IClassStudent,
  ICountry,
  StaffSalaryPackage,
  IEmploymentSettingsChangeLog,
  INumberCountry,
  ISegmentSelector,
  ITimezone,
  StaffSalaryPayment,
  NumberTypes,
  StaffSalaryAdvancement,
  ITag,
} from "@isms-core/interfaces";
import { ClassesService, NGRXService, StaffsService, StudentsService, TemplatesTagService } from "@isms-core/services";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzSpinModule } from "ng-zorro-antd/spin";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import { lastValueFrom } from "rxjs";
import { SubSink } from "subsink";
import { DateTime } from "luxon";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzTimelineModule } from "ng-zorro-antd/timeline";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzDividerModule } from "ng-zorro-antd/divider";
import { ManageStaffSalaryPackageModalComponent } from "../manage-staff-salary-package-modal/manage-staff-salary-package-modal.component";
import { StaffSalaryPackageSelectorComponent } from "../staff-salary-package-selector/staff-salary-package-selector.component";
import { ManageSalaryAdvancementComponent } from "../manage-salary-advancement/manage-salary-advancement.component";

@Component({
  selector: "isms-staff-info-drawer",
  templateUrl: "./staff-info-drawer.component.html",
  imports: [
    NgClass,
    NgIf,
    NgFor,
    DatePipe,
    JsonPipe,
    ReactiveFormsModule,
    NzSelectModule,
    NzDrawerModule,
    NzModalModule,
    NzInputModule,
    NzInputNumberModule,
    NzButtonModule,
    NzDatePickerModule,
    NzIconModule,
    NzToolTipModule,
    NzSpinModule,
    NzSwitchModule,

    NzCollapseModule,
    NzAlertModule,
    NzTimelineModule,
    NzDividerModule,
    NumberOnlyDirective,
    SegmentedSelectorComponent,
    StaffSalaryPackageSelectorComponent,
    ManageSalaryAdvancementComponent,
  ],
})
export class StaffInfoDrawerComponent {
  @Output("on-saved") onSaved: EventEmitter<void> = new EventEmitter<void>();
  @Input("staff-id") staffId: string;
  private readonly subSink: SubSink = new SubSink();
  public readonly personalInfoFormGroup: FormGroup = StaffPersonalInfoFormGroup();
  public readonly employmentSettingsFormGroup: FormGroup = StaffEmploymentSettingsFormGroup();
  public readonly staffSalaryAdvancementFormGroup: FormGroup = StaffSalaryAdvancementFormGroup();
  public showDrawer: boolean = false;
  public segmentOptions: Array<ISegmentSelector> = [
    {
      label: "Personal Information",
      icon: "ph-duotone ph-folder-user",
      disable: false,
    },
    {
      label: "Employment Settings",
      icon: "ph-duotone ph-toolbox",
      disable: false,
    },
    {
      label: "Salary Payment History",
      icon: "ph-duotone ph-article",
      disable: false,
    },
  ];
  public segmentIndex = 0;
  public branches: Array<IBranch> = [];
  public salaryPayments: Array<StaffSalaryPayment> = [];
  // public showSalaryChangelogModal: boolean = false;
  public selectedBranch: string = null;
  public loading: boolean = false;
  public noEmailAddress = false;

  public readonly numberCountries: Array<INumberCountry> = NumberCountries;
  public readonly timezones: Array<ITimezone> = Timezones;
  public readonly countries: Array<ICountry> = Countries;
  public readonly roles = Roles;
  public readonly positions = Positions;
  public readonly typeOfLabors = TypeOfLabors;
  public readonly workSchedules = WorkSchedules;
  public readonly contactNumberTypes: Array<NumberTypes> = [
    { name: "Home", value: "home" },
    { name: "Work", value: "work" },
  ];
  public tags: Array<ITag> = [];

  constructor(
    private readonly staffsService: StaffsService,
    private readonly classesService: ClassesService,
    private readonly ngrxService: NGRXService,
    private readonly templatesTagService: TemplatesTagService,
    private readonly nzNotificationService: NzNotificationService
  ) {
    this.subSink.add(this.ngrxService.branches().subscribe((res) => (this.branches = res)));
    this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));
  }

  private loadData(): void {
    this.loading = true;
    this.salaryPayments = [];
    this.personalInfoFormGroup.reset({
      branches: [],
    });
    this.employmentSettingsFormGroup.reset();

    lastValueFrom(this.staffsService.fetchById(this.staffId)).then((res) => {
      if (res.success) {
        this.loading = false;
        const staffInfo: IAccount = res.data;
        this.setPersonalInformation(staffInfo);
      }
    });

    lastValueFrom(this.staffsService.fetchEmploymentSettings(this.staffId)).then((res) => {
      if (res.success) {
        const employmentSettings: StaffSalaryPackage = res.data;
        this.setEmploymentSettings(employmentSettings);
      }
    });

    lastValueFrom(this.staffsService.fetchSalaryHistoryById(this.staffId)).then((res) => {
      this.salaryPayments = res.success ? res.data : [];
    });

    lastValueFrom(this.templatesTagService.fetch()).then((res) => (this.tags = res.success ? res.data : []));
  }

  public onUpdatePersonalInformation(): void {
    this.loading = true;
    const payload = this.personalInfoFormGroup.value;

    lastValueFrom(this.staffsService.updatePersonalInformation(payload, this.staffId)).then((res) => {
      this.loading = false;
      if (res.success) {
        const staffInfo: IAccount = res.data;
        this.setPersonalInformation(staffInfo);
        this.onSaved.emit();
      } else {
        this.nzNotificationService.error("Update Staff Information", res.message);
      }
    });
  }

  public onUpdateEmploymentSettings(): void {
    this.loading = true;
    const payload = this.employmentSettingsFormGroup.value;
    lastValueFrom(this.staffsService.updateEmploymentSettings(payload, this.staffId)).then((res) => {
      this.loading = false;
      if (res.success) {
        const employmentSettings: StaffSalaryPackage = res.data;
        this.setEmploymentSettings(employmentSettings);
        this.onSaved.emit();
      } else {
        this.nzNotificationService.error("Update Staff Employment Settings", res.message);
      }
    });
  }

  public onUpdateLeaveCredits(): void {
    this.loading = true;
    const payload = this.employmentSettingsFormGroup.value;
    lastValueFrom(this.staffsService.updateEmploymentSettings(payload, this.staffId)).then((res) => {
      this.loading = false;
      if (res.success) {
        const employmentSettings: StaffSalaryPackage = res.data;
        this.setEmploymentSettings(employmentSettings);
        this.onSaved.emit();
      } else {
        this.nzNotificationService.error("Update Staff Employment Settings", res.message);
      }
    });
  }

  private setPersonalInformation(staffInfo: IAccount): void {
    this.employmentSettingsFormGroup.get("staffId").setValue(staffInfo?._id || null);

    this.personalInfoFormGroup.reset({
      _id: staffInfo._id,
      accountId: staffInfo.accountId,
      firstName: staffInfo.firstName,
      lastName: staffInfo.lastName,
      gender: staffInfo?.gender || null,
      birthDate: staffInfo?.birthDate ? new Date(staffInfo.birthDate) : null,
      branches: staffInfo.propertiesBranches,
      // address: staffInfo.address || null,

      role: staffInfo.role,
      active: staffInfo.active,
      enrolled: staffInfo.enrolled,
      official: staffInfo.official,
      createdFrom: staffInfo.createdFrom,
    });

    this.personalInfoFormGroup
      .get("address")
      .get("street")
      .setValue(staffInfo.address?.street || null);
    this.personalInfoFormGroup
      .get("address")
      .get("city")
      .setValue(staffInfo.address?.city || null);
    this.personalInfoFormGroup
      .get("address")
      .get("country")
      .setValue(staffInfo.address?.country || null);
    this.personalInfoFormGroup
      .get("address")
      .get("state")
      .setValue(staffInfo.address?.state || null);
    this.personalInfoFormGroup
      .get("address")
      .get("postalCode")
      .setValue(staffInfo.address?.postalCode || null);
    this.personalInfoFormGroup
      .get("address")
      .get("timezone")
      .setValue(staffInfo.address?.timezone || null);

    this.emailAddressesFormArray.clear();
    staffInfo.emailAddresses.forEach((value) => {
      this.emailAddressesFormArray.push(new FormControl(value));
    });
    if (staffInfo.emailAddresses.length === 0) {
      this.emailAddressesFormArray.push(new FormControl(null, [Validators.required, Validators.email, Validators.pattern(EmailValidatorPattern)]));
      this.noEmailAddress = true;
    } else {
      this.noEmailAddress = false;
    }

    this.contactNumbersFormArray.clear();
    staffInfo.contactNumbers.forEach((value) => {
      this.contactNumbersFormArray.push(
        new FormGroup({
          countryCallingCode: new FormControl(value.countryCallingCode, [Validators.required]),
          number: new FormControl(value.number, [Validators.required]),
          type: new FormControl(value.type, [Validators.required]),
        })
      );
    });

    this.tagsFormArray.clear();
    staffInfo.tags.forEach((value) => {
      this.tagsFormArray.push(new FormControl(value));
    });

    this.sourcesFormArray.clear();
    staffInfo.sources.forEach((value) => {
      this.sourcesFormArray.push(new FormControl(value));
    });
  }

  private setEmploymentSettings(employmentSettings: StaffSalaryPackage): void {
    this.employmentSettingsFormGroup.reset({
      staffId: this.staffId,
      _id: employmentSettings?._id,
      // position: employmentSettings?.position,
      typeOfLabor: employmentSettings?.typeOfLabor,
      // workSchedule: employmentSettings?.workSchedule,
      basicSalary: employmentSettings?.basicSalary,
      dailySalary: employmentSettings?.dailySalary,
      consultingCommission: employmentSettings?.consultingCommission,
      hourlyTeachingRate: employmentSettings?.hourlyTeachingRate,
      hourlyTutoringRate: employmentSettings?.hourlyTutoringRate,
      hourlyTAPARate: employmentSettings?.hourlyTAPARate,
      insuranceAmount: employmentSettings?.insuranceAmount,
      employeePay: employmentSettings?.employeePay,
      companyPay: employmentSettings?.companyPay,
    });
    // this.salaryChangeLogs = employmentSettings.changeLogs;
  }

  public toggle(): void {
    this.showDrawer = !this.showDrawer;
    this.segmentIndex = 0;
    if (this.showDrawer) {
      this.loadData();
    }
  }

  // public toggleSalaryChangelogModal(): void {
  //   this.showSalaryChangelogModal = !this.showSalaryChangelogModal;
  // }

  public onChangeSegmentSelector(index: number): void {
    this.segmentIndex = index;
  }

  public addSource(): void {
    this.sourcesFormArray.push(new FormControl("", [Validators.required, Validators.maxLength(32)]));
  }

  public removeSource(index: number): void {
    this.sourcesFormArray.removeAt(index);
  }

  public addTag(): void {
    this.tagsFormArray.push(new FormControl("", [Validators.required, Validators.maxLength(32)]));
  }

  public removeTag(index: number): void {
    this.tagsFormArray.removeAt(index);
  }

  public addContactNumber(): void {
    this.contactNumbersFormArray.push(
      new FormGroup({
        countryCallingCode: new FormControl(NumberCountries[0].countryCallingCode, [Validators.required]),
        number: new FormControl(null, [Validators.required]),
        type: new FormControl(this.contactNumberTypes[0].value, [Validators.required]),
      })
    );
  }

  public removeContactNumber(index: number): void {
    this.contactNumbersFormArray.removeAt(index);
  }

  public onClickCopy(url: string): void {
    // const textareaElement = document.createElement("textarea") as HTMLTextAreaElement;
    // textareaElement.value = url;
    // document.body.appendChild(textareaElement);
    // textareaElement.select();
    // document.execCommand("copy");
    // document.body.removeChild(textareaElement);
    // this.nzNotificationService.create("success", "Link copied successfully", "", {
    //   nzPlacement: "bottomRight"
    // });
  }

  public toFormGroup(formGroup: AbstractControl): FormGroup {
    return formGroup as FormGroup;
  }

  public hideSelectedBranch(branchId: string): boolean {
    return this.personalInfoFormGroup.value.branches.indexOf(branchId) >= 0 || this.selectedBranch === branchId;
  }

  public get contactNumbersFormArray(): FormArray {
    return this.personalInfoFormGroup.get("contactNumbers") as FormArray;
  }

  public get emailAddressesFormArray(): FormArray {
    return this.personalInfoFormGroup.get("emailAddresses") as FormArray;
  }

  public get sourcesFormArray(): FormArray {
    return this.personalInfoFormGroup.get("sources") as FormArray;
  }

  public get tagsFormArray(): FormArray {
    return this.personalInfoFormGroup.get("tags") as FormArray;
  }

  public get computedInsuranceAmount(): number {
    const insuranceAmount = this.employmentSettingsFormGroup.value.insuranceAmount;
    const employeePay = this.employmentSettingsFormGroup.value.employeePay;
    const companyPay = this.employmentSettingsFormGroup.value.companyPay;
    return ((employeePay + companyPay) / 100) * insuranceAmount;
  }
}
