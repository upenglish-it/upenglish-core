import { FormArray, FormControl, FormGroup, Validators } from "@angular/forms";
import { ScheduleFormGroup } from "./common-formgroup";

export const ShiftFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    title: new FormControl(null),
    type: new FormControl(null, Validators.required),
    // scheduleId: new FormControl(null, Validators.required),
    schedule: ScheduleFormGroup(),
    staffs: new FormArray([]),
    careTakerId: new FormControl(null, Validators.required),
    homeworkCheckerId: new FormControl(null),
    classId: new FormControl(null, Validators.required),
    startDate: new FormControl(null, Validators.required),
    room: new FormControl(null, Validators.required),
    fromTime: new FormControl(null, Validators.required),
    toTime: new FormControl(null, Validators.required),
  });
};

export const ShiftStaffFormGroup = (): FormGroup => {
  return new FormGroup({
    id: new FormControl(null),
    schedule: ScheduleFormGroup(),
  });
};
