import { FormControl, FormGroup, Validators } from "@angular/forms";

export const ClassDayFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    name: new FormControl(null, Validators.required),
    days: new FormControl([], Validators.required),
  });
};
