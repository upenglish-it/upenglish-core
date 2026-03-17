import { FormControl, FormGroup, Validators } from "@angular/forms";

export const CourseFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    name: new FormControl(null, Validators.required),
    price: new FormControl(0, Validators.required),
    hourlyMonthlyPrice: new FormControl(0, Validators.required),
    hourlyPackagePrice: new FormControl(0, Validators.required),
    material: new FormControl(null),
  });
};
