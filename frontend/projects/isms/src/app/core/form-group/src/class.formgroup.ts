import { FormControl, FormGroup, Validators } from "@angular/forms";

export const ClassFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    name: new FormControl(null, Validators.required),
    course: new FormControl(null, Validators.required),
    typeOfRate: new FormControl("monthly-rate", Validators.required),
  });
};
