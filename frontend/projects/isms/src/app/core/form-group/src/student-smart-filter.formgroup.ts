import { FormArray, FormControl, FormGroup, Validators } from "@angular/forms";
import { NameValidatorPattern } from "@isms-core/constants";

export const StudentSmartFilterFormGroup = () => {
  return new FormGroup({
    _id: new FormControl(null),
    title: new FormControl("", [Validators.required]),
    filters: new FormArray([]),
  });
};
