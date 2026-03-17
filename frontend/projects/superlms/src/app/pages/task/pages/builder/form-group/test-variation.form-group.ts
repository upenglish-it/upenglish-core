import { FormArray, FormControl, FormGroup } from "@angular/forms";
import { ulid } from "ulidx";
import { PartFormGroupI } from "./test-variation-part.form-group";

export const VariationFormGroup = () => {
  return new FormGroup({
    id: new FormControl<string>(ulid()),
    parts: new FormArray([]),
    reviewerAnswer: new FormControl<string>(""),
    audioRemarks: new FormControl<string>(""),
  });
};

export interface VariationFormGroupI {
  id: string;
  parts: PartFormGroupI[];
  reviewerAnswer: string;
  audioRemarks: string;
}
