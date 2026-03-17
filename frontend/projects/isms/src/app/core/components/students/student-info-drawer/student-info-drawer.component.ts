import { DatePipe, JsonPipe, NgClass, NgFor, NgIf, NgStyle } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { Countries, EmailValidatorPattern, Timezones } from "@isms-core/constants";
import { NumberCountries } from "@isms-core/constants/src/number-countries.constant";
import { NumberOnlyDirective } from "@isms-core/directives";
import { CreateStudentFormGroup, StudentGuardianFormGroup } from "@isms-core/form-group";
import { IAccount, IBranch, IClassStudent, IClassStudentRecord, ICountry, INumberCountry, ISegmentSelector, ISource, ITag, ITimezone, NumberTypes } from "@isms-core/interfaces";
import { ClassesService, NGRXService, StaffsService, StudentsService, TemplatesSourceService, TemplatesTagService } from "@isms-core/services";
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
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { SubSink } from "subsink";
import { DateTime } from "luxon";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { isEmpty } from "lodash";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { FormattedCurrencyPipe } from "@isms-core/pipes";
import { SavingsBreakdownModalComponent } from "../savings-breakdown-modal/savings-breakdown-modal.component";

@Component({
  selector: "isms-student-info-drawer",
  templateUrl: "./student-info-drawer.component.html",
  imports: [
    NgIf,
    NgFor,
    DatePipe,
    JsonPipe,
    NgClass,
    ReactiveFormsModule,
    NzSelectModule,
    NzDrawerModule,
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
    FormattedCurrencyPipe,
    SegmentedSelectorComponent,
    NumberOnlyDirective,
    FormattedCurrencyPipe,
    SavingsBreakdownModalComponent,
  ],
})
export class StudentInfoDrawerComponent {
  @Output("on-saved") onSaved: EventEmitter<void> = new EventEmitter<void>();
  @Input("tags-type") tagType: "pipeline" | "relationship" = "relationship";
  @Input("student-id") studentId: string;
  private subSink: SubSink = new SubSink();
  public account: IAccount = null;
  public createStudentFormGroup: FormGroup = CreateStudentFormGroup();
  public showDrawer: boolean = false;
  public segmentOptions: Array<ISegmentSelector> = [
    {
      label: "Personal Information",
      icon: "ph-duotone ph-folder-user",
      disable: false,
    },
    {
      label: "Enrollment History and Finances",
      icon: "ph-duotone ph-chalkboard-teacher",
      disable: false,
    },
    // {
    //   label: "Achievements",
    //   icon: "ph-duotone ph-briefcase",
    //   disable: false
    // },
    // {
    //   label: "Performance",
    //   icon: "ph-duotone ph-shooting-star",
    //   disable: false
    // }
  ];
  public segmentIndex = 0;
  public numberCountries: Array<INumberCountry> = NumberCountries;

  public timezones: Array<ITimezone> = Timezones;
  public countries: Array<ICountry> = Countries;
  public branches: Array<IBranch> = [];
  public selectedBranch: string = null;
  public loading: boolean = false;
  public noEmailAddress = false;
  public enrolledClasses: Array<any> = [];
  public guardians = [
    { name: "Father", value: "father" },
    { name: "Mother", value: "mother" },
    { name: "Brother", value: "bother" },
    { name: "Sister", value: "sister" },
  ];
  public readonly contactNumberTypes: Array<NumberTypes> = [
    { name: "Home", value: "home" },
    { name: "Work", value: "work" },
  ];
  public staffs: Array<IAccount> = [];
  public tags: Array<ITag> = [];
  public sources: Array<ISource> = [];

  constructor(
    private readonly studentService: StudentsService,
    private readonly classesService: ClassesService,
    private readonly staffsService: StaffsService,
    private readonly templatesTagService: TemplatesTagService,
    private readonly templatesSourceService: TemplatesSourceService,
    private readonly ngrxService: NGRXService,
    private readonly nzNotificationService: NzNotificationService
  ) {
    this.subSink.add(this.ngrxService.account().subscribe((res) => (this.account = res)));
    this.subSink.add(this.ngrxService.branches().subscribe((res) => (this.branches = res)));
    this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));
  }

  private loadData(): void {
    this.loading = true;

    this.subSink.add(
      this.createStudentFormGroup
        .get("active")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe(() => {
          this.onUpdate();
        })
    );

    lastValueFrom(this.studentService.fetchById(this.studentId)).then((res) => {
      if (res.success) {
        this.loading = false;
        const studentInfo: IAccount = res.data;
        this.setData(studentInfo);
      }
    });

    lastValueFrom(this.classesService.breakdown({ studentId: this.studentId })).then((res) => {
      if (res.success) {
        // const breakdown: Array<IClassStudent> = res.data;
        this.enrolledClasses = (res.data as Array<IClassStudent>).map((data) => {
          const debtRecords: Array<IClassStudentRecord> = [];

          data.debtRecords.forEach((record: IClassStudentRecord) => {
            const date = DateTime.fromObject({ day: record.day, month: record.month, year: record.year });

            const exist = debtRecords.find((dr) => {
              const drDate = DateTime.fromObject({ day: dr.day, month: dr.month, year: dr.year });
              return drDate.month === date.month && drDate.year === date.year;
            });

            const totalAmount = data.debtRecords
              .filter((dr) => {
                const drDate = DateTime.fromObject({ day: dr.day, month: dr.month, year: dr.year });
                return drDate.month === date.month && drDate.year === date.year;
              })
              .reduce((pv, cv) => pv + cv.amount, 0);

            // const totalDebtRecords = data.debtRecords.filter(
            //   (d) => DateTime.fromISO(date.date).month === DateTime.fromISO(d.date).month && DateTime.fromISO(date.date).year === DateTime.fromISO(d.date).year
            // );

            if (isEmpty(exist)) {
              debtRecords.push({ ...record, date: date.toISO(), totalAmount: totalAmount } as any);
            }
          });

          return {
            name: data.class.name,
            active: true,
            status: data.status,
            course: data.course,
            totalAmountNotPaid: data.totalAmountNotPaid,
            totalAmountPaid: data.totalAmountPaid,
            lastAttendance: DateTime.local(data.latestRecord.year, data.latestRecord.month, data.latestRecord.day).toJSDate(),
            debtRecords: debtRecords,
            totalDays: data.records.length,
            firstRecord: data.firstRecord,
            latestRecord: data.latestRecord,
            createdAt: data.createdAt,
          };
        });
      }
    });

    lastValueFrom(this.staffsService.fetch({ includeMe: true })).then((res) => {
      this.staffs = [];
      if (res.success) {
        const staffs: Array<IAccount> = res.data;
        this.staffs = staffs.filter((staff) => staff.role === "marketing" || staff.role === "receptionist" || staff.role === "admin");
      }
    });

    lastValueFrom(this.templatesTagService.fetch({ type: this.tagType })).then((res) => (this.tags = res.success ? res.data : []));
    lastValueFrom(this.templatesSourceService.fetch()).then((res) => (this.sources = res.success ? res.data : []));
  }

  public onUpdate(): void {
    this.loading = true;
    const payload = this.createStudentFormGroup.value;
    delete payload.saving; // remove savings from payload
    lastValueFrom(this.studentService.update(payload, this.studentId)).then((res) => {
      this.loading = false;
      if (res.success) {
        const studentInfo: IAccount = res.data;
        this.setData(studentInfo);
        this.onSaved.emit();
      } else {
        this.nzNotificationService.error("Update Student Information", res.message);
      }
    });
  }

  private setData(studentInfo: IAccount): void {
    this.createStudentFormGroup.reset({
      _id: studentInfo._id,
      accountId: studentInfo.accountId,
      cmnd: studentInfo.cmnd,
      firstName: studentInfo.firstName,
      lastName: studentInfo.lastName,
      gender: studentInfo?.gender || null,
      birthDate: studentInfo?.birthDate ? new Date(studentInfo.birthDate) : null,
      branches: studentInfo.propertiesBranches,
      // address: studentInfo.address || null,
      additionalNotes: studentInfo?.additionalNotes || null,

      role: studentInfo.role,
      active: studentInfo.active,
      enrolled: studentInfo.enrolled,
      official: studentInfo.official,
      createdFrom: studentInfo.createdFrom,
      assignedTo: studentInfo.assignedTo,
      saving: studentInfo.saving,
      redundantSaving: studentInfo.redundantSaving,
    });

    this.createStudentFormGroup
      .get("address")
      .get("street")
      .setValue(studentInfo.address?.street || null);
    this.createStudentFormGroup
      .get("address")
      .get("city")
      .setValue(studentInfo.address?.city || null);
    this.createStudentFormGroup
      .get("address")
      .get("country")
      .setValue(studentInfo.address?.country || null);
    this.createStudentFormGroup
      .get("address")
      .get("state")
      .setValue(studentInfo.address?.state || null);
    this.createStudentFormGroup
      .get("address")
      .get("postalCode")
      .setValue(studentInfo.address?.postalCode || null);
    this.createStudentFormGroup
      .get("address")
      .get("timezone")
      .setValue(studentInfo.address?.timezone || null);

    this.emailAddressesFormArray.clear();
    studentInfo.emailAddresses.forEach((value) => {
      this.emailAddressesFormArray.push(new FormControl(value));
    });
    if (studentInfo.emailAddresses.length === 0) {
      this.emailAddressesFormArray.push(new FormControl(null, [Validators.required, Validators.email, Validators.pattern(EmailValidatorPattern)]));
      this.noEmailAddress = true;
    } else {
      this.noEmailAddress = false;
    }

    this.contactNumbersFormArray.clear();
    studentInfo.contactNumbers.forEach((value) => {
      this.contactNumbersFormArray.push(
        new FormGroup({
          countryCallingCode: new FormControl(value.countryCallingCode, [Validators.required]),
          number: new FormControl(value.number, [Validators.required]),
          type: new FormControl(value.type, []),
        })
      );
    });

    this.tagsFormArray.clear();
    studentInfo.tags.forEach((value) => {
      this.tagsFormArray.push(new FormControl(value));
    });

    this.sourcesFormArray.clear();
    studentInfo.sources.forEach((value) => {
      this.sourcesFormArray.push(new FormControl(value));
    });

    if (!isEmpty(studentInfo.guardians)) {
      this.guardiansFormArray.clear();
      studentInfo.guardians.forEach((value) => {
        const guardianFormGroup = StudentGuardianFormGroup();
        guardianFormGroup.get("name").setValue(value.name);
        guardianFormGroup.get("relationship").setValue(value.relationship);
        guardianFormGroup.get("primaryNumber").setValue(value.primaryNumber);
        guardianFormGroup.get("secondaryNumber").setValue(value.secondaryNumber);
        this.guardiansFormArray.push(guardianFormGroup);
      });
    }
  }

  public toggle(): void {
    this.showDrawer = !this.showDrawer;
    if (this.showDrawer) {
      this.loadData();
    }
  }

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
        type: new FormControl(this.contactNumberTypes[0].value, [Validators.required]),
        countryCallingCode: new FormControl(NumberCountries[0].countryCallingCode, [Validators.required]),
        number: new FormControl(null, [Validators.required]),
      })
    );
  }

  public addGuardian(): void {
    const guardianFormGroup = StudentGuardianFormGroup();
    this.guardiansFormArray.push(guardianFormGroup);
  }

  public removeContactNumber(index: number): void {
    this.contactNumbersFormArray.removeAt(index);
  }

  public removeGuardian(index: number): void {
    this.guardiansFormArray.removeAt(index);
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
    return this.createStudentFormGroup.value.branches.indexOf(branchId) >= 0 || this.selectedBranch === branchId;
  }

  public get contactNumbersFormArray(): FormArray {
    return this.createStudentFormGroup.get("contactNumbers") as FormArray;
  }

  public get emailAddressesFormArray(): FormArray {
    return this.createStudentFormGroup.get("emailAddresses") as FormArray;
  }

  public get sourcesFormArray(): FormArray {
    return this.createStudentFormGroup.get("sources") as FormArray;
  }

  public get tagsFormArray(): FormArray {
    return this.createStudentFormGroup.get("tags") as FormArray;
  }

  public get guardiansFormArray(): FormArray {
    return this.createStudentFormGroup.get("guardians") as FormArray;
  }

  public get totalAmountDebt(): number {
    return this.enrolledClasses.reduce((pv, cv) => pv + cv.totalAmountNotPaid, 0);
  }
}
