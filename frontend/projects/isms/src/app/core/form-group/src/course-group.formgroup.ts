import { FormControl, FormGroup, Validators } from "@angular/forms";

export const CourseGroupFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    name: new FormControl(null, Validators.required),
    courses: new FormControl([], Validators.required),
  });
};
