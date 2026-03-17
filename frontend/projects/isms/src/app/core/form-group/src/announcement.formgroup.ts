import { FormControl, FormGroup, Validators } from "@angular/forms";

export const AnnouncementFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    classId: new FormControl(null, Validators.required),
    title: new FormControl(null, Validators.required),
    message: new FormControl(null, Validators.required),
  });
};

export const ReminderFormGroup = (): FormGroup => {
  return new FormGroup({
    enable: new FormControl(false),
    prior: new FormControl("after", Validators.required),
    span: new FormControl("minutes", Validators.required),
    duration: new FormControl(0, Validators.required),
  });
};

export const OrganizerFormGroup = (): FormGroup => {
  return new FormGroup({
    accountId: new FormControl(null, [Validators.required]),
    name: new FormControl(null, [Validators.required]),
    emailAddress: new FormControl(null, [Validators.required]),
  });
};
