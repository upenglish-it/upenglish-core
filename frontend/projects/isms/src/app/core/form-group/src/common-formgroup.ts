import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ISchedule } from "@isms-core/interfaces";
import { DateTime } from "luxon";
import { Frequency } from "rrule";

export const ScheduleFormGroup = () => {
  return new FormGroup({
    fromDate: new FormControl(DateTime.now().toJSDate(), [Validators.required]),
    fromTime: new FormControl(DateTime.now().toJSDate(), [Validators.required]),
    fromTimezone: new FormControl("UTC", [Validators.required]), //Intl.DateTimeFormat().resolvedOptions().timeZone
    toDate: new FormControl(DateTime.now().toJSDate(), [Validators.required]),
    toTime: new FormControl(DateTime.now().plus({ minutes: 30 }).toJSDate(), [Validators.required]),
    toTimezone: new FormControl("UTC", [Validators.required]), //Intl.DateTimeFormat().resolvedOptions().timeZone
    allDay: new FormControl(true, [Validators.required]),
    recurrence: new FormGroup({
      enable: new FormControl(false),
      value: new FormControl("do-not-repeat"),
      freq: new FormControl(null),
      interval: new FormControl(null),
      // count: new FormControl(null),
      byweekday: new FormControl([]),
      bymonth: new FormControl([]),
      ends: new FormGroup({
        type: new FormControl(null),
        endDate: new FormControl(null),
        // occurrence: new FormControl(30)
        count: new FormControl(null),
      }),
    }),
  });
};

export const SetScheduleFormGroup = (scheduleFormGroup: FormGroup, value: ISchedule) => {
  scheduleFormGroup.get("fromDate").setValue(value.fromDate);
  scheduleFormGroup.get("fromTime").setValue(value.fromTime);
  scheduleFormGroup.get("fromTimezone").setValue(value.fromTimezone);

  scheduleFormGroup.get("toDate").setValue(value.toDate);
  scheduleFormGroup.get("toTime").setValue(value.toTime);
  scheduleFormGroup.get("toTimezone").setValue(value.toTimezone);
  scheduleFormGroup.get("allDay").setValue(value.allDay);
  scheduleFormGroup.get("recurrence").get("enable").setValue(value.recurrence.enable);
  scheduleFormGroup.get("recurrence").get("value").setValue(value.recurrence.freq);
  scheduleFormGroup.get("recurrence").get("freq").setValue(value.recurrence.freq);
  scheduleFormGroup.get("recurrence").get("interval").setValue(value.recurrence.interval);
  scheduleFormGroup.get("recurrence").get("byweekday").setValue(value.recurrence.byweekday);
  scheduleFormGroup.get("recurrence").get("bymonth").setValue(value.recurrence.bymonth);
  scheduleFormGroup.get("recurrence").get("ends").get("type").setValue(value.recurrence.ends.type);
  scheduleFormGroup.get("recurrence").get("ends").get("endDate").setValue(value.recurrence.ends.endDate);
  scheduleFormGroup.get("recurrence").get("ends").get("count").setValue(value.recurrence.ends.count);
};
