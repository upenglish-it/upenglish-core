import { FormArray, FormControl, FormGroup, Validators } from "@angular/forms";
import { VariationFormGroupI } from "./test-variation.form-group";
import { CourseI } from "@superlms/models/courses/courses.endpoints.datatypes";

export const TestFormGroup = () => {
  return new FormGroup({
    name: new FormControl<string>("", Validators.required),
    type: new FormControl<"reading" | "listening" | "writing" | "speaking">("reading", Validators.required),
    mode: new FormControl<"viewing" | "editing">("editing", Validators.required),
    submittedDate: new FormControl<string | null>(null),
    duration: new FormControl<number>(0, Validators.required), //--- secs

    selectedPartIndex: new FormControl<number>(0, Validators.required),
    selectedVariationIndex: new FormControl<number>(0, Validators.required),
    variations: new FormArray([]),

    // Use only in UI builder state
    stateSettings: new FormGroup({
      type: new FormControl<"template" | "test" | null>(null),
      mode: new FormControl<"viewing" | "editing" | null>(null),
      action: new FormControl<"teacher-reviewing" | "student-answering" | "builder-editing" | "student-viewing-results" | null>(null),
    }),
  });
};

export interface TestI {
  _id: string;
  name: string;
  type: "reading" | "listening" | "writing" | "speaking";
  duration: number; //--- secs
  course: CourseI;
  createdAt: string;
  submittedDate: string | null;
  selectedPartIndex: number;
  selectedVariationIndex: number;
  variations: VariationFormGroupI[];

  //--- Added in FE
  totalNeedToReviewItems?: number;
  totalQuestions?: number;
  totalPoints?: number;
}
