import { FormControl, FormGroup, Validators } from "@angular/forms";

export const ClassTimeFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    name: new FormControl(null, Validators.required),
    from: new FormControl(null, Validators.required),
    to: new FormControl(null, Validators.required),
  });
};
