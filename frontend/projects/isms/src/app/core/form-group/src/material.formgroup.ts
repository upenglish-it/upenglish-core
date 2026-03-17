import { FormControl, FormGroup, Validators } from "@angular/forms";

export const MaterialFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    name: new FormControl(null, Validators.required),
    price: new FormControl(null, Validators.required),
    quantity: new FormControl(null, Validators.required),
  });
};
