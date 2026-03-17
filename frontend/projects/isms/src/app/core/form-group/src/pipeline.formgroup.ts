import { FormArray, FormControl, FormGroup, Validators } from "@angular/forms";
import { SYSTEM_ID } from "@isms-core/utils";

export const PipelineFormGroup = () => {
  return new FormGroup({
    _id: new FormControl(null),
    details: new FormGroup({
      title: new FormControl(null, [Validators.required]),
    }),
    sourcingTeam: new FormGroup({
      ownerId: new FormControl(null, [Validators.required]),
      participantIds: new FormControl([], [Validators.required]),
    }),
    sourcingPipeline: new FormGroup({
      stages: new FormArray([], [Validators.required]),
    }),
  });
};

export const PipelineStageFormGroup = (): FormGroup => {
  return new FormGroup({
    order: new FormControl(null, [Validators.required]),
    state: new FormControl(null, [Validators.required]),
    type: new FormControl(null, [Validators.required]),
    title: new FormControl(null, [Validators.required]),
    color: new FormControl("#f6f8f9", [Validators.required]),
    id: new FormControl(SYSTEM_ID(), [Validators.required]),
    editable: new FormControl(true, [Validators.required]),
    won: new FormControl(false, [Validators.required]),
  });
};
