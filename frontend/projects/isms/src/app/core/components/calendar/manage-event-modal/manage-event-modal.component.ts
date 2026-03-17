import { NgFor, NgIf } from "@angular/common";
import { Component, EventEmitter, OnInit, Output } from "@angular/core";
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MembersSelectorComponent } from "@isms-core/components/common/members-selector/members-selector.component";
import { ScheduleSelectorComponent } from "@isms-core/components/common/schedule-selector/schedule-selector.component";
import { AttendeeFormGroup, OrganizerFormGroup, ReminderFormGroup, ScheduleFormGroup, SetScheduleFormGroup } from "@isms-core/form-group";
import { ICalendar, ICalendarEvent, ICalendarEventAttendee, IIntegration } from "@isms-core/interfaces";
import { AccountStore } from "@isms-core/ngrx";
import { CalendarsService } from "@isms-core/services";
import { ComposedRRule } from "@isms-core/utils";
import { isEmpty } from "lodash";
import { DateTime } from "luxon";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzTypographyModule } from "ng-zorro-antd/typography";
import { NgxTinymceModule } from "ngx-tinymce";
import { lastValueFrom } from "rxjs";

@Component({
  selector: "isms-manage-event-modal",
  templateUrl: "./manage-event-modal.component.html",
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    NzModalModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzTypographyModule,
    NzPopconfirmModule,
    NgxTinymceModule,
    ScheduleSelectorComponent,
    MembersSelectorComponent,
  ],
})
export class ManageEventModalComponent implements OnInit {
  @Output("on-submitted") onSubmitted: EventEmitter<ICalendarEvent> = new EventEmitter();
  @Output("on-updated") onUpdated: EventEmitter<ICalendarEvent> = new EventEmitter();
  @Output("on-deleted") onDeleted: EventEmitter<ICalendarEvent> = new EventEmitter();

  public eventFormGroup: FormGroup = new FormGroup({
    _id: new FormControl(null),
    title: new FormControl(null, [Validators.required]),
    description: new FormControl(null, [Validators.required]),
    location: new FormControl(null, [Validators.required]),
    reminder: ReminderFormGroup(),
    schedule: ScheduleFormGroup(),
    attendees: new FormArray([]),
    organizer: OrganizerFormGroup(),
    integrationId: new FormControl(null, [Validators.required]),
    calendarId: new FormControl(null, [Validators.required]),
  });
  public showModal: boolean = false;
  public submitLoading: boolean = false;
  public deleteLoading: boolean = false;

  public calendarEvent: ICalendarEvent = null;

  public integrations: Array<IIntegration> = [];
  public calendars: Array<ICalendar> = [];

  constructor(
    private readonly calendarsService: CalendarsService,
    private readonly accountStore: AccountStore
  ) {}

  public ngOnInit(): void {
    lastValueFrom(this.calendarsService.integrated()).then((res) => {
      if (res.success) {
        this.integrations = res.success ? res.data : [];
        const firstIntegration = this.integrations[0];
        this.eventFormGroup.get("integrationId").setValue(firstIntegration._id);
        this.calendars = firstIntegration.calendars.filter((c) => c.data.canEdit);
        const firstCalendar = this.calendars[0];
        this.eventFormGroup.get("calendarId").setValue(firstCalendar._id);
      }
    });
    this.eventFormGroup.get("integrationId").valueChanges.subscribe((value) => {
      this.calendars = this.integrations.find((i) => i._id === value)?.calendars || [];
      this.calendars = this.calendars.filter((c) => c.data.canEdit);
    });
  }

  public toggle(): void {
    this.showModal = !this.showModal;
    // this.eventFormGroup.reset({
    //   schedule: ScheduleFormGroup()
    // });

    //  this.eventFormGroup.get("schedule").patchValue(ScheduleFormGroup());
    if (this.showModal) {
      this.resetEventFormGroup();
      // const event: any = {
      //   _id: null,
      //   title: "Orientation",
      //   description:
      //     '<p><em><span style="text-decoration: underline;"><strong>Student orientation 😎🤠</strong></span></em><br><br>Tuesday, September 5<br>Time zone: Asia/Manila<br>Google Meet joining info<br>Video call link: <a href="https://meet.google.com/apz-uttk-fgn">Meeting Link</a></p>',
      //   location: "Office",
      //   reminder: {
      //     enable: false,
      //     prior: "after",
      //     span: "minutes",
      //     duration: 0
      //   },
      //   schedule: {
      //     fromDate: "2023-09-20",
      //     fromTime: "04:45:02.353",
      //     fromTimezone: "Asia/Manila",
      //     toDate: "2023-09-29",
      //     toTime: "04:45:02.354",
      //     toTimezone: "Asia/Manila",
      //     allDay: true,
      //     recurrence: {
      //       enable: false,
      //       value: "FREQ=DAILY;COUNT=1",
      //       freq: 3,
      //       interval: null,
      //       byweekday: [],
      //       bymonth: [],
      //       ends: {
      //         type: "never",
      //         endDate: null,
      //         count: null
      //       }
      //     }
      //   },
      //   attendees: [
      //     {
      //       accountId: "ISBB0042D098B741C4888183E20A1BBF35",
      //       emailAddress: "upmarketing@upenglishvietnam.com",
      //       name: "Marketing Dev",
      //       required: false,
      //       response: "none",
      //       profilePhoto: "md"
      //     }
      //   ],
      //   meta: {
      //     createdFrom: "isms-internally"
      //   },
      //   calendars: null,
      //   integrations: null
      // };
      // this.setFormGroup(event);
    }
  }

  public setFormGroup(event: ICalendarEvent): void {
    this.calendarEvent = event;

    console.log("event >>> ", event);
    this.eventFormGroup.get("integrationId").patchValue(event.integrations);
    this.eventFormGroup.get("calendarId").patchValue(event.calendars._id);

    this.eventFormGroup.get("_id").patchValue(event._id);
    this.eventFormGroup.get("title").patchValue(event.title);

    const divElement = document.createElement("div");
    divElement.innerHTML = event.description;

    const description = (divElement.innerText || divElement.textContent).trim();
    // this.eventFormGroup.get("description").patchValue(description);
    this.eventFormGroup.get("description").patchValue(event.description);

    this.eventFormGroup.get("location").patchValue(event.location);
    this.eventFormGroup.get("reminder").patchValue(event.reminder);

    let recurrenceEndDate = event.schedule.recurrence?.ends?.endDate || event.schedule.toDate;
    if (event.schedule.recurrence.ends.type === "never") {
      recurrenceEndDate = DateTime.now().plus({ years: 3 }).toISODate();
    }

    // console.log({
    //   fromDate: DateTime.fromISO(event.schedule.fromDate as any).toJSDate(),
    //   fromTime: DateTime.fromISO(event.schedule.fromTime as any).toJSDate(),
    //   toDate: new Date(recurrenceEndDate),
    //   toTime: DateTime.fromISO(event.schedule.toTime as any).toJSDate()
    // });

    // const fromDate = DateTime.fromISO(event.schedule.fromDate as any);
    const fromDate = DateTime.fromISO(event.schedule.fromDate as any); //.setZone(event.schedule.fromTimezone);
    const startTime = DateTime.fromISO(event.schedule.fromTime as any); //.setZone(event.schedule.fromTimezone);
    let start = new Date(Date.UTC(fromDate.year, fromDate.month - 1, fromDate.day));
    if (!event.schedule.allDay) {
      start = new Date(Date.UTC(fromDate.year, fromDate.month - 1, fromDate.day, startTime.hour, startTime.minute, startTime.millisecond));
    }
    const _fromDate = new Date(Date.UTC(fromDate.year, fromDate.month - 1, fromDate.day));
    const fromTime = DateTime.fromISO(event.schedule.fromTime as any);
    const _fromTime = new Date(Date.UTC(fromDate.year, fromDate.month - 1, fromDate.day, fromTime.hour, fromTime.minute, fromTime.millisecond));

    const toDate = DateTime.fromISO(event.schedule.toDate as any)
      .plus({
        ...(event.schedule.toTimezone === "UTC" && !event.schedule.allDay ? { days: 1 } : null),
      })
      .minus({
        ...(event.schedule.toTimezone === "UTC" && event.schedule.allDay ? { days: 1 } : null),
      });
    let end = new Date(Date.UTC(toDate.year, toDate.month - 1, toDate.day));
    console.log("toDate 1", toDate.toISO(), toDate.toJSDate(), toDate.toUTC());
    const _toDate = new Date(Date.UTC(toDate.year, toDate.month - 1, toDate.day));

    console.log("toDate 2", _toDate);

    const toTime = DateTime.fromISO(event.schedule.toTime as any);
    const _toTime = new Date(Date.UTC(toDate.year, toDate.month - 1, toDate.day, toTime.hour, toTime.minute, toTime.millisecond));

    const recurrence = ComposedRRule({
      ...event.schedule,
      fromDate: _toDate,
      fromTime: _fromTime,
      toDate: new Date(recurrenceEndDate), //DateTime.fromISO(recurrenceEndDate as any).toJSDate(),
      toTime: _toTime,
    });

    console.log("recurrence", recurrence.approximate.all().length);

    this.scheduleFormGroup.get("fromDate").setValue(start);
    this.scheduleFormGroup.get("fromTime").setValue(_fromTime);
    this.scheduleFormGroup.get("fromTimezone").setValue(event.schedule.fromTimezone);

    this.scheduleFormGroup.get("toDate").setValue(end);
    this.scheduleFormGroup.get("toTime").setValue(_toTime);
    this.scheduleFormGroup.get("toTimezone").setValue(event.schedule.toTimezone);
    // this.scheduleFormGroup.get("").setValue(DateTime.fromISO(event.schedule.toDate as any).toJSDate());
    // this.scheduleFormGroup.get("").setValue(DateTime.fromISO(event.schedule.toTime as any).toJSDate());
    this.scheduleFormGroup.get("allDay").setValue(event.schedule.allDay);
    this.scheduleFormGroup.get("recurrence").get("enable").setValue(event.schedule.recurrence.enable);
    this.scheduleFormGroup
      .get("recurrence")
      .get("value")
      .setValue(event.schedule.recurrence.freq !== null ? "custom" : "do-not-repeat");
    this.scheduleFormGroup.get("recurrence").get("freq").setValue(event.schedule.recurrence.freq);
    this.scheduleFormGroup.get("recurrence").get("interval").setValue(event.schedule.recurrence.interval);
    this.scheduleFormGroup.get("recurrence").get("byweekday").setValue(event.schedule.recurrence.byweekday);
    this.scheduleFormGroup.get("recurrence").get("bymonth").setValue(event.schedule.recurrence.bymonth);
    this.scheduleFormGroup.get("recurrence").get("ends").get("type").setValue(event.schedule.recurrence.ends.type);
    this.scheduleFormGroup.get("recurrence").get("ends").get("endDate").setValue(event.schedule.recurrence.ends.endDate);
    this.scheduleFormGroup.get("recurrence").get("ends").get("count").setValue(event.schedule.recurrence.ends.count);

    this.eventFormGroup.get("organizer").get("accountId").setValue(event.organizer.accountId);
    this.eventFormGroup.get("organizer").get("name").setValue(event.organizer.name);
    this.eventFormGroup.get("organizer").get("emailAddress").setValue(event.organizer.emailAddress);

    this.attendeesFormArray.clear();
    event.attendees.forEach((attendee: ICalendarEventAttendee) => {
      const attendeeFormGroup = AttendeeFormGroup();
      attendeeFormGroup.patchValue(attendee);
      this.attendeesFormArray.push(attendeeFormGroup);
    });

    this.showModal = true;
  }

  public onSubmit(): void {
    this.submitLoading = true;
    this.eventFormGroup.markAllAsTouched();
    if (this.eventFormGroup.valid) {
      if (!isEmpty(this.eventFormGroup.value._id)) {
        // update event
        lastValueFrom(this.calendarsService.updateEvent(this.eventFormGroup.value._id, this.eventPayload)).then((res) => {
          this.submitLoading = false;
          if (res.success) {
            this.showModal = false;
            this.onUpdated.emit(res.data);
          }
        });
      } else {
        // create event
        lastValueFrom(this.calendarsService.create(this.eventPayload)).then((res) => {
          this.submitLoading = false;
          if (res.success) {
            this.showModal = false;
            this.onSubmitted.emit(res.data);
          }
        });
      }
    }
  }

  public onDelete(): void {
    this.deleteLoading = true;
    lastValueFrom(this.calendarsService.delete(this.eventFormGroup.value._id)).then((res) => {
      this.deleteLoading = false;
      if (res.success) {
        this.showModal = false;
        this.onDeleted.emit(this.calendarEvent);
      }
    });
  }

  public resetEventFormGroup(): void {
    this.eventFormGroup.get("integrationId").reset(null);
    this.eventFormGroup.get("calendarId").reset(null);
    this.eventFormGroup.get("_id").reset(null);
    this.eventFormGroup.get("title").reset(null);
    this.eventFormGroup.get("description").reset(null);
    this.eventFormGroup.get("location").reset(null);
    this.eventFormGroup.get("reminder").reset({ enable: false, prior: "after", span: "minutes", duration: 5 });
    this.eventFormGroup.get("schedule").reset(ScheduleFormGroup().value);
    this.attendeesFormArray.clear();
    this.eventFormGroup.get("organizer").get("accountId").reset(this.accountStore.account._id);
    this.eventFormGroup.get("organizer").get("name").reset(this.accountStore.fullName);
    this.eventFormGroup.get("organizer").get("emailAddress").reset(this.accountStore.emailAddress);
    this.submitLoading = false;
  }

  public get scheduleFormGroup(): FormGroup {
    return this.eventFormGroup.get("schedule") as FormGroup;
  }

  public get attendeesFormArray(): FormArray {
    return this.eventFormGroup.get("attendees") as FormArray;
  }

  private get eventPayload(): any {
    console.log(this.scheduleFormGroup.value);

    const _fromDate = DateTime.fromJSDate(this.scheduleFormGroup.value.fromDate);
    const fromDate = _fromDate.toISODate();
    let _fromTime = DateTime.fromJSDate(this.scheduleFormGroup.value.fromTime);
    if (this.scheduleFormGroup.value.allDay) {
      _fromTime = _fromTime.set({ hour: 0, minute: 0, millisecond: 0 });
    }
    let fromTime = _fromTime.toISOTime({ includeOffset: false });
    const fromTimeZone = this.scheduleFormGroup.value.fromTimezone;
    let fromDateTime = _fromDate.setZone(fromTimeZone).set({ hour: _fromTime.hour, minute: _fromTime.minute, millisecond: 0 }).toISO();

    let _toDate = DateTime.fromJSDate(this.scheduleFormGroup.value.toDate);
    if (this.scheduleFormGroup.value.allDay) {
      console.log("toDate 1", _toDate.toISO());

      _toDate = _toDate.plus({ days: 1 }).set({ hour: 0, minute: 0, millisecond: 0 });

      console.log("toDate 2", _toDate.toISO());
    }
    console.log("toDate 3", _toDate.toISO());
    const toDate = _toDate.toISODate();
    let _toTime = DateTime.fromJSDate(this.scheduleFormGroup.value.toTime);
    if (this.scheduleFormGroup.value.allDay) {
      _toTime = _toTime.set({ hour: 0, minute: 0, millisecond: 0 });
    }
    let toTime = _toTime.toISOTime({ includeOffset: false });
    const toTimeZone = this.scheduleFormGroup.value.toTimezone;
    let toDateTime = _toDate.setZone(toTimeZone).set({ hour: _toTime.hour, minute: _toTime.minute, millisecond: 0 }).toISO();

    /* organizer */
    // const organizerEmailAddress = event.organizer.emailAddress.address.toLowerCase();
    // const organizerAccount = accounts.find((acc) => acc.emailAddresses.includes(organizerEmailAddress));
    // const organizer: IEventOrganizer = {
    //   accountId: this.eventFormGroup.value.title,
    //   name: !isEmpty(organizerAccount) ? `${organizerAccount.firstName} ${organizerAccount.lastName}` : event.organizer.emailAddress.name,
    //   emailAddress: organizerEmailAddress
    // };

    if (this.scheduleFormGroup.value.allDay) {
      fromDateTime = _fromDate.setZone(fromTimeZone).set({ hour: 0, minute: 0, millisecond: 0 }).toISO();
      toDateTime = _toDate.setZone(toTimeZone).plus({ days: 1 }).set({ hour: 0, minute: 0, millisecond: 0 }).toISO();
    }

    const payload: any = {
      title: this.eventFormGroup.value.title,
      description: this.eventFormGroup.value.description,
      location: this.eventFormGroup.value.location,
      reminder: {
        enable: false,
        prior: "after",
        span: "minutes",
        duration: 0,
      },
      schedule: {
        fromDateTime: fromDateTime,
        fromDate: fromDate,
        fromTime: fromTime,
        fromTimezone: fromTimeZone,
        toDateTime: toDateTime,
        toDate: toDate,
        toTime: toTime,
        toTimezone: toTimeZone,
        allDay: this.scheduleFormGroup.value.allDay,
        recurrence: {
          enable: this.scheduleFormGroup.value.recurrence.enable,
          value: this.scheduleFormGroup.value.recurrence.value,
          freq: this.scheduleFormGroup.value.recurrence.freq,
          interval: this.scheduleFormGroup.value.recurrence.interval,
          byweekday: this.scheduleFormGroup.value.recurrence.byweekday,
          bymonth: this.scheduleFormGroup.value.recurrence.bymonth,
          ends: {
            type: this.scheduleFormGroup.value.recurrence.ends.type,
            endDate: this.scheduleFormGroup.value.recurrence.ends.endDate,
            count: this.scheduleFormGroup.value.recurrence.ends.count,
          },
        },
      },
      attendees: this.eventFormGroup.value.attendees,
      // organizer: {
      //   accountId: "",
      //   name: "",
      //   emailAddress: ""
      // },
      meta: {
        ...(isEmpty(this.eventFormGroup.value._id) ? { createdFrom: "isms-internally" } : null),
      },
      calendars: this.eventFormGroup.value.calendarId,
      integrations: this.eventFormGroup.value.integrationId,
    };

    //  if (payload.recurrence) {
    //    const recurrence: any = {
    //      enable: true,
    //      ...payload.schedule.recurrence,
    //      freq: MicrosoftCalendarRecurrencePattern.find((rec) => rec.name === event.recurrence.pattern.type).value,
    //      ...(event.recurrence.pattern.interval ? { interval: event.recurrence.pattern.interval } : null),
    //      ...(event.recurrence.pattern.month ? { bymonth: [event.recurrence.pattern.month] } : null),
    //      ...(event.recurrence.pattern.daysOfWeek
    //        ? {
    //            byweekday: event.recurrence.pattern.daysOfWeek.map((day) => {
    //              const selectedDay = MicrosoftCalendarRecurrenceDaysOfWeek.find((d) => d.name === day).value;
    //              return selectedDay;
    //            })
    //          }
    //        : null),
    //      ends: {
    //        ...payload.schedule.recurrence.ends,
    //        type: MicrosoftCalendarRecurrenceRangeType.find((v) => v.name === event.recurrence.range.type).value,
    //        endDate: event.recurrence.range?.endDate || null,
    //        count: event.recurrence.range?.numberOfOccurrences || null
    //      }
    //    };
    //    payload.schedule.recurrence = recurrence;
    //  }

    return payload;
    // {
    //   title: this.eventFormGroup.value.title,
    //   description: this.eventFormGroup.value.description
    // };
  }
}
