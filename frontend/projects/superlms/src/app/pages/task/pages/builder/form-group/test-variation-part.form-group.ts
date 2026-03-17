import { FormArray, FormControl, FormGroup } from "@angular/forms";
import { ItemFormGroupI } from "./test-variation-part-item.form-group";
import { ulid } from "ulidx";

export const PartFormGroup = () => {
  return new FormGroup({
    id: new FormControl<string>(ulid()),
    description: new FormControl<string>(""),
    showLeftPanel: new FormControl<boolean>(true),
    items: new FormArray([]),
  });
};

export interface PartFormGroupI {
  id: string;
  description: string;
  showLeftPanel: boolean;
  items: ItemFormGroupI[];
}
