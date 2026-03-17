import { FormArray, FormControl, FormGroup, Validators } from "@angular/forms";
import { EmailValidatorPattern, NameValidatorPattern } from "@isms-core/constants";

export const CreateStudentFormGroup = () => {
  return new FormGroup({
    _id: new FormControl(null),
    accountId: new FormControl(null),
    branches: new FormControl([]),
    firstName: new FormControl("", [Validators.required, Validators.maxLength(50), Validators.pattern(NameValidatorPattern)]),
    lastName: new FormControl("", [Validators.required, Validators.maxLength(50), Validators.pattern(NameValidatorPattern)]),
    emailAddresses: new FormArray([]),
    contactNumbers: new FormArray([]),
    gender: new FormControl(null, Validators.required),
    birthDate: new FormControl("", Validators.required),
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
    guardians: new FormArray([]),
    additionalNotes: new FormControl(null),

    // added for student info
    role: new FormControl(null),
    cmnd: new FormControl(null),
    active: new FormControl(false),
    enrolled: new FormControl(false),
    official: new FormControl(false),
    createdFrom: new FormControl(null),
    assignedTo: new FormControl(null),
    saving: new FormControl(0),
    redundantSaving: new FormControl(0),
  });
};

export const StudentGuardianFormGroup = () => {
  return new FormGroup({
    name: new FormControl("", [Validators.required, Validators.maxLength(50), Validators.pattern(NameValidatorPattern)]),
    relationship: new FormControl("", Validators.required),
    primaryNumber: new FormControl(null, Validators.required),
    secondaryNumber: new FormControl(null),
  });
};
