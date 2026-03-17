import { FormControl, FormGroup, Validators } from "@angular/forms";

export const AttendeeFormGroup = () => {
  return new FormGroup({
    accountId: new FormControl(null),
    emailAddress: new FormControl(null, [Validators.required]),
    name: new FormControl(null, [Validators.required]),
    required: new FormControl(null, [Validators.required]),
    response: new FormControl(null, [Validators.required]),
    profilePhoto: new FormControl(null, [Validators.required]),
  });
};
