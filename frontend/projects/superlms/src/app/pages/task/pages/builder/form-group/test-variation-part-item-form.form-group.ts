import { FormArray, FormControl, FormGroup } from "@angular/forms";
import { ulid } from "ulidx";

export const ChoiceFormGroup = () => {
  return new FormGroup({
    id: new FormControl(ulid()),
    text: new FormControl("Untitled"),
  });
};

export const DragNDropFormGroup = () => {
  return new FormGroup({
    id: new FormControl(ulid()),
    itemNumber: new FormControl("A"),
    value: new FormControl("Untitled"),
  });
};

/** One row in box-ticking v2: question text + correct answer (teacher) + student answer. */
export const BoxTickingRowFormGroup = () => {
  return new FormGroup({
    question: new FormControl<string>(""),
    originalAnswer: new FormControl<string | null>(null),
    participantAnswer: new FormControl<string | null>(null),
  });
};
