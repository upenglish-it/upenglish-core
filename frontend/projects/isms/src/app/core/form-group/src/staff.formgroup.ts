import { FormArray, FormControl, FormGroup, Validators } from "@angular/forms";
import { NameValidatorPattern } from "@isms-core/constants";

export const StaffPersonalInfoFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    role: new FormControl(null),
    accountId: new FormControl(null),
    branches: new FormControl([]),
    firstName: new FormControl("", [Validators.required, Validators.maxLength(50), Validators.pattern(NameValidatorPattern)]),
    lastName: new FormControl("", [Validators.required, Validators.maxLength(50), Validators.pattern(NameValidatorPattern)]),
    emailAddresses: new FormArray([]),
    contactNumbers: new FormArray([]),
    gender: new FormControl(null, Validators.required),
    birthDate: new FormControl(""),
    address: new FormGroup({
      street: new FormControl(null),
      city: new FormControl(null),
      country: new FormControl(null),
      state: new FormControl(null),
      postalCode: new FormControl(null),
      timezone: new FormControl(null),
    }),
    tags: new FormArray([]),
    sources: new FormArray([]),
    // added for staff info
    active: new FormControl(false),
    createdFrom: new FormControl(null),
  });
};

export const StaffEmploymentSettingsFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    staffId: new FormControl(null, Validators.required),
    position: new FormControl(null, Validators.required),
    jobTitle: new FormControl(null, Validators.required),
    typeOfLabor: new FormControl(null, Validators.required),
    workSchedule: new FormControl(null, Validators.required),
    // startDate: new FormControl(null, Validators.required),
    // endDate: new FormControl(null, Validators.required),
    basicSalary: new FormControl(null, Validators.required),
    dailySalary: new FormControl(null, Validators.required),
    consultingCommission: new FormControl(null, Validators.required),
    hourlyTeachingRate: new FormControl(null, Validators.required),
    hourlyTutoringRate: new FormControl(null, Validators.required),
    hourlyTAPARate: new FormControl(null, Validators.required),
    insuranceAmount: new FormControl(null, Validators.required),
    employeePay: new FormControl(null, Validators.required),
    companyPay: new FormControl(null, Validators.required),
  });
};

export const StaffSalaryFormGroup = (): FormGroup => {
  return new FormGroup({
    // _id: new FormControl(null),
    // dateIssued: new FormControl(null, Validators.required),
    workDate: new FormControl(null, Validators.required),
    absences: new FormControl(0, Validators.required),
    // basicSalary: new FormControl(null),
    // dailySalary: new FormControl(null),
    // consultingCommission: new FormControl(null),
    consultingCommissionQuantity: new FormControl(0, Validators.required),
    // hourlyTeachingRate: new FormControl(null),
    hourlyTeachingRateQuantity: new FormControl(0, Validators.required),
    // hourlyTutoringRate: new FormControl(null),
    hourlyTutoringRateQuantity: new FormControl(0, Validators.required),
    // hourlyTAPARate: new FormControl(null),
    hourlyTAPARateQuantity: new FormControl(0, Validators.required),
    addition: new FormControl(0),
    subtraction: new FormControl(0),
    // insuranceAmount: new FormControl(null),
    // employeePay: new FormControl(null),
    // companyPay: new FormControl(null)
  });
};

export const StaffLeaveSettingsFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    staffId: new FormControl(null, Validators.required),
    date: new FormControl(null, Validators.required),
    typeOfLabor: new FormControl(null, Validators.required),
  });
};

export const StaffSalaryPackageFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    dateIssued: new FormControl(null),

    jobTitle: new FormControl(null, Validators.required),
    // workSchedule: new FormControl(null, Validators.required),

    name: new FormControl(null, Validators.required),
    typeOfLabor: new FormControl(null, Validators.required),

    // workDate: new FormControl(null, Validators.required),

    // absences: new FormControl(0, Validators.required),
    basicSalary: new FormControl(null, Validators.required),
    dailySalary: new FormControl(0), // daily rate is based on the staff-work

    consultingCommission: new FormControl(null, Validators.required),
    hourlyTeachingRate: new FormControl(null, Validators.required),
    hourlyTutoringRate: new FormControl(null, Validators.required),
    hourlyTAPARate: new FormControl(null, Validators.required),

    insuranceAmount: new FormControl(null, Validators.required),
    employeePay: new FormControl(null, Validators.required),
    companyPay: new FormControl(null, Validators.required),
  });
};

export const StaffSalaryAdvancementFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    loanedAmount: new FormControl(null, Validators.required),
    paidAmount: new FormControl(null),
    paymentSequence: new FormControl(null),
    agreement: new FormGroup({
      amount: new FormControl(null, Validators.required),
      every: new FormControl(null, Validators.required),
    }),
    transactions: new FormArray([]),
    staff: new FormControl(null),

    /* added in FE */
    remainingBalance: new FormControl(null),
    payNow: new FormControl(false),
  });
};
