import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { Animations } from "@isms-core/constants";
import Calendar, { ISchedule } from "tui-calendar";
import { DateTime } from "luxon";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzCalendarModule } from "ng-zorro-antd/calendar";
import { DatePipe, NgFor, NgIf } from "@angular/common";
import { ManageEventModalComponent } from "@isms-core/components/calendar/manage-event-modal/manage-event-modal.component";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { SubSink } from "subsink";
import { ManageCalendarProviderComponent } from "@isms-core/components/calendar/manage-calendar-provider/manage-calendar-provider.component";
import { CalendarsService, MicrosoftCalendarService } from "@isms-core/services";
import { lastValueFrom } from "rxjs";
import { ICalendarEvent, IIntegration } from "@isms-core/interfaces";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzSpinModule } from "ng-zorro-antd/spin";
import { ComposedRRule } from "@isms-core/utils";
import { isEmpty } from "lodash";

@Component({
  templateUrl: "./board.page.html",
  animations: [Animations.down],
  imports: [
    NgIf,
    NgFor,
    FormsModule,
    DatePipe,
    ReactiveFormsModule,
    NzDatePickerModule,
    NzButtonModule,
    NzIconModule,
    NzDropDownModule,
    NzSelectModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzCalendarModule,
    NzSwitchModule,
    NzToolTipModule,
    NzSpinModule,
    ManageEventModalComponent,
    ManageCalendarProviderComponent,
  ],
})
export class CalendarBoardPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild("manageEventModal") manageEventModal: ManageEventModalComponent;

  public subSink: SubSink = new SubSink();
  public calendarFormGroup: FormGroup = new FormGroup({
    calendarCalendarDate: new FormControl(new Date()),
    calendarView: new FormControl("month"),
  });

  public tuiCalendar: Calendar = null;

  // public selectedData = DateTime.now().toJSDate();
  public integrations: Array<IIntegration> = [];
  public calendarEvents: Array<ICalendarEvent> = [];

  @ViewChild("tuiCalendarContainer") private tuiCalendarContainer: ElementRef;

  constructor(
    public readonly microsoftCalendarService: MicrosoftCalendarService,
    private readonly calendarsService: CalendarsService
  ) {}

  public ngOnInit(): void {
    this.subSink.add(
      this.calendarFormGroup.get("calendarView").valueChanges.subscribe((value) => {
        this.tuiCalendar.changeView(value);
      })
    );
    this.subSink.add(
      this.calendarFormGroup.get("calendarCalendarDate").valueChanges.subscribe((value) => {
        this.tuiCalendar.setDate(value);
      })
    );
  }

  public ngAfterViewInit(): void {
    this.tuiCalendar = new Calendar(this.tuiCalendarContainer.nativeElement, {
      usageStatistics: false,
      defaultView: this.calendarFormGroup.value.calendarView, //"week", // day, week,  month

      // only for day/week view
      // taskView: [],
      // scheduleView: ["time"],
      // month: {
      //   visibleWeeksCount: 1
      // },

      isReadOnly: true,
      // useCreationPopup: true,
      // useDetailPopup: true

      // template: {
      //   monthGridHeader: (model) => {
      //     var date = new Date(model.date);
      //     var template = '<div class="tui-full-calendar-weekday-grid-date text-isms-500 border-b w-full">' + date.getDate() + "</div>";
      //     return template;
      //   },
      //   dayGridTitle: (day) => {
      //     var template = '<span class="tui-full-calendar-weekday-grid-date text-isms-500 border-b">' + day + ">></span>";
      //     return template;
      //   }
      //   // monthGridHeader: function (data) {
      //   //   var date = parseInt(data.date.split("-")[2], 10);

      //   //   return '<span class="calendar-month-header" style="margin-left: 4px;">' + (data.month + 1) + "/" + date + "</span>";
      //   // },
      //   // monthGridHeaderExceed: function (hiddenEvents) {
      //   //   return '<span class="calendar-month-header-exceed" style="font-size: 0.8rem">' + "+" + hiddenEvents + "</span>";
      //   // },
      //   // monthDayname: function (data) {
      //   //   var label = data.label;

      //   //   if (data.day === 5) {
      //   //     label = "🎉 TGIF";
      //   //   }

      //   //   return '<span class="calendar-month-day-name">' + label + "</span>";
      //   // }
      // }
    });

    this.tuiCalendar.on({
      clickSchedule: (e) => {
        console.log("clickSchedule", e);
        const event = e.schedule.raw["event"] as ICalendarEvent;
        this.manageEventModal.setFormGroup(event);
      },
      beforeCreateSchedule: (e) => {
        console.log("beforeCreateSchedule", e);
        // open a creation popup
      },
      beforeUpdateSchedule: (e) => {
        console.log("beforeUpdateSchedule", e);
        e.schedule.start = e.start;
        e.schedule.end = e.end;
        // this.tuiCalendar.updateSchedule(e.schedule.id, e.schedule.calendarId, e.schedule);
      },
      beforeDeleteSchedule: (e) => {
        console.log("beforeDeleteSchedule", e);
        this.tuiCalendar.deleteSchedule(e.schedule.id, e.schedule.calendarId);
      },
    });

    this.loadData();
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  private loadData(): void {
    this.tuiCalendar.createSchedules([]);
    this.tuiCalendar.clear();

    lastValueFrom(this.calendarsService.integrated()).then((res) => {
      if (res.success) {
        this.integrations = (res.data as Array<IIntegration>).map((integration) => this.constructIntegration(integration));
        this.loadCalendarEvents();
      }
    });
  }

  private loadCalendarEvents(): void {
    lastValueFrom(this.calendarsService.fetchEvents()).then((res) => {
      this.calendarEvents = res.success ? res.data : [];
      this.manageCalendarEvents(this.calendarEvents);
    });
  }

  // private setTuiCalendarEvents(calendarEvents: Array<ICalendarEvent>, currentIndex: number, isRecurring: boolean): void {
  //   const event = calendarEvents[currentIndex];
  //   const startDate = DateTime.fromISO(event.schedule.fromDate as any); //.setZone(event.schedule.fromTimezone);
  //   const endDate = DateTime.fromISO(event.schedule.fromDate as any); //.setZone(event.schedule.toTimezone);

  //   const start = new Date(Date.UTC(startDate.year, startDate.month - 1, startDate.day, startDate.hour, startDate.minute, startDate.millisecond));
  //   const end = new Date(Date.UTC(endDate.year, endDate.month - 1, endDate.day, endDate.hour, endDate.minute, endDate.millisecond));

  //   const schedule = {
  //     id: event._id,
  //     calendarId: event.calendars,
  //     title: event.title,
  //     body: event.description,
  //     category: "time",
  //     color: "#ff3823",
  //     bgColor: "#fff1f0",
  //     dragBgColor: "blue",
  //     borderColor: "#ff3823",
  //     // isReadOnly: true,
  //     // start: DateTime.now().toISO(),
  //     // end: DateTime.now().plus({ days: 3 }).toISO()
  //     // recurrenceRule: recurrence.approximate.toString(),
  //     start: start,
  //     end: end
  //   };
  //   this.tuiCalendar.createSchedules([schedule]);
  // }

  public integrateNewCalendar(): void {
    this.microsoftCalendarService.authenticate().then((res) => {
      // console.log("res>>>>", res);
      if (res.success) {
        // this.integrations = res.data;
        this.loadData();
      }
    });
  }

  public onUpdateIntegration(integrationId: string, integrationIndex: number): void {
    lastValueFrom(this.calendarsService.fetchIntegratedById(integrationId)).then((res) => {
      this.integrations[integrationIndex] = this.constructIntegration(res.data);
    });
  }

  public onDeleteIntegration(integrationIndex: number): void {
    this.integrations.splice(integrationIndex, 1);
    // const integration = this.integrations[integrationIndex];
    // this.tuiCalendar.deleteSchedule(scheduleId, calendarId, false);

    this.loadData();
  }

  public onCheckedCalendars(calendarIds: Array<{ id: string; show: boolean }>, integrationIndex: number): void {
    // console.log("calendarIds", calendarIds);
    calendarIds.forEach((calendar) => {
      this.tuiCalendar.toggleSchedules(calendar.id, calendar.show);
    });
  }

  public onSubmittedCalendarEvent(calendarEvent: ICalendarEvent): void {
    this.manageCalendarEvents([calendarEvent]);
  }

  public onDeletedCalendarEvent(calendarEvent: ICalendarEvent): void {
    this.tuiCalendar.deleteSchedule(calendarEvent._id, calendarEvent.calendars._id);
  }

  public onUpdatedCalendarEvent(calendarEvent: ICalendarEvent): void {
    this.tuiCalendar.deleteSchedule(calendarEvent._id, calendarEvent.calendars._id);
    this.manageCalendarEvents([calendarEvent]);
  }

  private constructIntegration(integration: IIntegration): IIntegration {
    integration["expand"] = true;
    integration.calendars.map((calendar) => {
      calendar["selected"] = calendar.data.canEdit;
      return calendar;
    });
    return integration;
  }

  private manageCalendarEvents(calendarEvents: Array<ICalendarEvent>): void {
    calendarEvents.forEach((event) => {
      if (event.schedule.recurrence.freq !== null) {
        let recurrenceEndDate = event.schedule.recurrence?.ends?.endDate || event.schedule.toDate;
        if (event.schedule.recurrence.ends.type === "never") {
          recurrenceEndDate = DateTime.now().plus({ years: 3 }).toISODate();
        }

        const recurrence = ComposedRRule({
          ...event.schedule,
          fromDate: DateTime.fromISO(event.schedule.fromDate as any).toJSDate(),
          fromTime: DateTime.fromISO(event.schedule.fromTime as any).toJSDate(),
          toDate: DateTime.fromISO(recurrenceEndDate as any).toJSDate(),
          toTime: DateTime.fromISO(event.schedule.toTime as any).toJSDate(),
        });

        recurrence.approximate.all().forEach((date) => {
          const schedule: ISchedule = {
            raw: { event: event },
            id: event._id,
            calendarId: event.calendars._id,
            title: event.title,
            body: event.description,
            category: "time",
            color: !isEmpty(event.calendars.data.hexColor) ? event.calendars.data.hexColor : "#ff3823",
            bgColor: !isEmpty(event.calendars.data.hexColor) ? `${event.calendars.data.hexColor}30` : "#fff1f0",
            borderColor: !isEmpty(event.calendars.data.hexColor) ? event.calendars.data.hexColor : "#ff3823",
            dragBgColor: "blue",
            start: date,
            end: date,
          };
          this.tuiCalendar.createSchedules([schedule]);
        });
      } else {
        const startDate = DateTime.fromISO(event.schedule.fromDate as any); //.setZone(event.schedule.fromTimezone);
        const startTime = DateTime.fromISO(event.schedule.fromTime as any); //.setZone(event.schedule.fromTimezone);
        let start = new Date(Date.UTC(startDate.year, startDate.month - 1, startDate.day));
        if (!event.schedule.allDay) {
          start = new Date(Date.UTC(startDate.year, startDate.month - 1, startDate.day, startTime.hour, startTime.minute, startTime.millisecond));
        }

        const endDate = DateTime.fromISO(event.schedule.toDate as any)
          .plus({
            ...(event.schedule.toTimezone === "UTC" && !event.schedule.allDay ? { days: 1 } : null),
          })
          .minus({
            ...(event.schedule.toTimezone === "UTC" && event.schedule.allDay ? { days: 1 } : null),
          });
        const endTime = DateTime.fromISO(event.schedule.toTime as any); //.setZone(event.schedule.fromTimezone);
        let end = new Date(Date.UTC(endDate.year, endDate.month - 1, endDate.day));
        console.log(event.title, end);
        if (!event.schedule.allDay) {
          end = new Date(Date.UTC(endDate.year, endDate.month - 1, endDate.day, endTime.hour, endTime.minute, endTime.millisecond));
        }

        const schedule: ISchedule = {
          raw: { event: event },
          id: event._id,
          calendarId: event.calendars._id,
          title: event.title,
          body: event.description,
          category: "time",
          color: !isEmpty(event.calendars.data.hexColor) ? event.calendars.data.hexColor : "#ff3823",
          bgColor: !isEmpty(event.calendars.data.hexColor) ? `${event.calendars.data.hexColor}30` : "#fff1f0",
          borderColor: !isEmpty(event.calendars.data.hexColor) ? event.calendars.data.hexColor : "#ff3823",
          dragBgColor: "blue",
          // isReadOnly: true,
          // start: DateTime.now().toISO(),
          // end: DateTime.now().plus({ days: 3 }).toISO()
          // ...(event.title === "Meeting with team" ? { recurrenceRule: "FREQ=DAILY" } : null),
          //recurrenceRule: "FREQ=DAILY", //recurrence.approximate.toString(),
          start: start,
          end: end,
        };
        this.tuiCalendar.createSchedules([schedule]);
      }
    });
  }
}
