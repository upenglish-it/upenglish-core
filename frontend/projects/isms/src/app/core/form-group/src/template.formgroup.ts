import { FormControl, FormGroup, Validators } from "@angular/forms";

export const TagFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    value: new FormControl(null, Validators.required),
    color: new FormControl(null, Validators.required),
    type: new FormControl(null, Validators.required),
  });
};

export const SourceFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    value: new FormControl(null, Validators.required),
  });
};
