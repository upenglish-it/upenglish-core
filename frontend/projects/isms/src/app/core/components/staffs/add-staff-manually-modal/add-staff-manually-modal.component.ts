import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { IAccount, IBranch, ICountry, INumberCountry, ITag, ITimezone, NumberTypes } from "@isms-core/interfaces";
import { NzModalModule } from "ng-zorro-antd/modal";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzButtonModule } from "ng-zorro-antd/button";
import { Countries, EmailValidatorPattern, Roles, Timezones } from "@isms-core/constants";
import { NgFor, NgIf } from "@angular/common";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NumberCountries } from "@isms-core/constants/src/number-countries.constant";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NumberOnlyDirective } from "@isms-core/directives";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { lastValueFrom } from "rxjs";
import { NGRXService, StaffsService, StudentsService, TemplatesTagService } from "@isms-core/services";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { SubSink } from "subsink";
import { differenceInCalendarDays } from "date-fns";
import { DateTime } from "luxon";
import { StaffPersonalInfoFormGroup } from "@isms-core/form-group";

@Component({
  selector: "isms-add-staff-manually-modal",
  templateUrl: "./add-staff-manually-modal.component.html",
  imports: [
    NgIf,
    NgFor,
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
  ],
})
export class AddStaffManuallyModalComponent implements OnInit, OnDestroy {
  public numberCountries: Array<INumberCountry> = NumberCountries;
  public timezones: Array<ITimezone> = Timezones;
  public countries: Array<ICountry> = Countries;
  public personalInfoFormGroup: FormGroup = StaffPersonalInfoFormGroup();

  //   new FormGroup({
  //   firstName: new FormControl("", [Validators.required, Validators.maxLength(50), Validators.pattern(NameValidatorPattern)]),
  //   lastName: new FormControl("", [Validators.required, Validators.maxLength(50), Validators.pattern(NameValidatorPattern)]),
  //   emailAddresses: new FormArray([new FormControl(null, [Validators.required, Validators.maxLength(32), Validators.email, Validators.pattern(EmailValidatorPattern)])]),
  //   contactNumbers: new FormArray([
  //     // new FormGroup({
  //     //   countryCallingCode: new FormControl(NumberCountries[0].countryCallingCode, [Validators.required]),
  //     //   number: new FormControl(null, [Validators.required])
  //     // })
  //   ]),
  //   gender: new FormControl(null, Validators.required),
  //   birthDate: new FormControl("", Validators.required),
  //   address: new FormGroup({
  //     street: new FormControl(null, Validators.required),
  //     city: new FormControl(null, Validators.required),
  //     country: new FormControl(Countries[0].code, Validators.required),
  //     state: new FormControl(null, Validators.required),
  //     postalCode: new FormControl(null, Validators.required),
  //     timezone: new FormControl(Timezones[0].timezone, Validators.required)
  //   }),
  //   tags: new FormArray([]),
  //   sources: new FormArray([])

  //   // source: new FormControl(null),
  //   // lead: new FormControl(false),
  //   // firstName: new FormControl('', Validators.required),
  //   // lastName: new FormControl('', Validators.required),
  //   // emailAddress: new FormControl('', Validators.required),
  //   // contactNumber: new FormControl('', Validators.required),
  //   // contactNumber2: new FormControl('', Validators.required),
  //   // gender: new FormControl(null, Validators.required),
  //   // birthdate: new FormControl('', Validators.required),
  //   // address: new FormControl('', Validators.required),
  //   // guardians: new FormArray(
  //   //   [
  //   //     // new FormGroup({
  //   //     //   name: new FormControl('Ryan', Validators.required),
  //   //     //   guardianRelationshipId: new FormControl(null, Validators.required),
  //   //     //   contactNumber: new FormControl('9494943411', Validators.required),
  //   //     //   contactNumber2: new FormControl('9494943412', Validators.required),
  //   //     // }),
  //   //   ],
  //   //   Validators.required,
  //   // ),
  //   // tuitionAttendances: new FormArray([]),
  // });
  @Output("on-submitted") onSubmitted: EventEmitter<IAccount> = new EventEmitter();
  private subSink: SubSink = new SubSink();
  public branches: Array<IBranch> = [];
  public selectedBranch: string = null;
  public loadingCreateButton: boolean = false;
  public showModal: boolean = false;
  public readonly contactNumberTypes: Array<NumberTypes> = [
    { name: "Home", value: "home" },
    { name: "Work", value: "work" },
  ];
  public tags: Array<ITag> = [];

  public roles = Roles;
  constructor(
    private readonly staffsService: StaffsService,
    private readonly templatesTagService: TemplatesTagService,
    private readonly nzNotificationService: NzNotificationService,
    private readonly ngrxService: NGRXService
  ) {
    this.subSink.add(this.ngrxService.branches().subscribe((res) => (this.branches = res)));
    this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));
  }

  public ngOnInit(): void {
    this.emailAddressesFormArray.push(new FormControl(null, [Validators.required, Validators.maxLength(100), Validators.email, Validators.pattern(EmailValidatorPattern)]));
    // this.setTemporaryData();
    lastValueFrom(this.templatesTagService.fetch()).then((res) => (this.tags = res.success ? res.data : []));
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  public setTemporaryData(): void {
    this.personalInfoFormGroup.get("firstName").setValue("John");
    this.personalInfoFormGroup.get("lastName").setValue("Doe");

    this.emailAddressesFormArray.clear();
    this.emailAddressesFormArray.push(
      new FormControl("johndoe@yopmail.com", [Validators.required, Validators.maxLength(100), Validators.email, Validators.pattern(EmailValidatorPattern)])
    );

    this.contactNumbersFormArray.clear();
    this.contactNumbersFormArray.push(
      new FormGroup({
        countryCallingCode: new FormControl("+63", [Validators.required]),
        number: new FormControl("9278977591", [Validators.required]),
      })
    );
    this.personalInfoFormGroup.get("gender").setValue("male");
    this.personalInfoFormGroup.get("birthDate").setValue("1994-01-01");
    const addressFormGroup = this.personalInfoFormGroup.get("address") as FormGroup;
    addressFormGroup.get("street").setValue("Room 428");
    addressFormGroup.get("city").setValue("Saginaw");
    addressFormGroup.get("country").setValue("US");
    addressFormGroup.get("state").setValue("Michigan");
    addressFormGroup.get("postalCode").setValue(48604);
    addressFormGroup.get("timezone").setValue("America/Denver");
    this.tagsFormArray.push(new FormControl("beginner", [Validators.required, Validators.maxLength(32)]));
    this.sourcesFormArray.push(new FormControl("facebook", [Validators.required, Validators.maxLength(32)]));
  }

  public toggle(): void {
    this.showModal = !this.showModal;
    this.personalInfoFormGroup.reset({ branches: [] });
    this.emailAddressesFormArray.clear();
    this.addEmailAddress();
    this.contactNumbersFormArray.clear();
    this.sourcesFormArray.clear();
    this.tagsFormArray.clear();
  }

  public onCreate(): void {
    this.personalInfoFormGroup.markAllAsTouched();

    this.loadingCreateButton = true;

    lastValueFrom(this.staffsService.create(this.personalInfoFormGroup.value)).then((res) => {
      this.loadingCreateButton = false;
      if (res.success) {
        this.showModal = false;
        this.onSubmitted.emit(res.data);
      }
      this.nzNotificationService.create(res.success ? "success" : "error", "Create Staff", res.message, { nzPlacement: "bottomRight" });
    });
  }

  public addEmailAddress(): void {
    this.emailAddressesFormArray.push(new FormControl("", [Validators.required, Validators.maxLength(100), Validators.email, Validators.pattern(EmailValidatorPattern)]));
  }

  public removeEmailAddress(index: number): void {
    this.emailAddressesFormArray.removeAt(index);
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

  public removeContactNumber(index: number): void {
    this.contactNumbersFormArray.removeAt(index);
  }

  public toFormGroup(formGroup: AbstractControl): FormGroup {
    return formGroup as FormGroup;
  }

  public hideSelectedBranch(branchId: string): boolean {
    return this.personalInfoFormGroup.value.branches.indexOf(branchId) >= 0 || this.selectedBranch === branchId;
  }

  public disabledPreviousDate = (current: Date): boolean => differenceInCalendarDays(current, DateTime.now().toJSDate()) > 0;

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
}
