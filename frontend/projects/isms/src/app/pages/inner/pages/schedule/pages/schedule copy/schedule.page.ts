import { Component, OnInit, ViewChild } from "@angular/core";
import { Animations } from "@isms-core/constants";
import { FormsModule } from "@angular/forms";
import { JsonPipe, NgFor, NgIf } from "@angular/common";
import * as moment from "moment";
import { Item, Period, Section, Events, NgxTimeSchedulerService, StaffSchedulerComponent, ClassSchedulerComponent } from "@isms-core/components/common/ngx-time-scheduler";
import { SchedulesService, SchedulesShiftsService } from "@isms-core/services";
import { lastValueFrom } from "rxjs";
import { DateTime } from "luxon";
import { ComposedRRule, FormatTime, SortSchedule, SortScheduleShift } from "@isms-core/utils";
import { ISchedule, IScheduleSchedulesShift, ISegmentSelector } from "@isms-core/interfaces";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { ScheduleSegmentOptions } from "./data";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { ManageStaffScheduleDrawerComponent } from "@isms-core/components/schedule/manage-staff-schedule-drawer/manage-staff-schedule-drawer.component";
import { ManageStaffScheduleShiftDrawerComponent } from "@isms-core/components/schedule/manage-staff-schedule-shift-drawer/manage-staff-schedule-shift-drawer.component";
import { ActivatedRoute } from "@angular/router";

@Component({
  templateUrl: "./schedule.page.html",
  animations: [Animations.down],
  imports: [
    NgIf,
    NgFor,
    FormsModule,
    JsonPipe,
    NzDropDownModule,
    NzButtonModule,
    NzIconModule,
    StaffSchedulerComponent,
    ClassSchedulerComponent,
    SegmentedSelectorComponent,
    ManageStaffScheduleDrawerComponent,
    ManageStaffScheduleShiftDrawerComponent,
  ],
})
export class SchedulePage implements OnInit {
  public segmentOptions: Array<ISegmentSelector> = ScheduleSegmentOptions;
  public segmentIndex = 0;

  public onChangeSegmentSelector(index: number): void {
    this.segmentIndex = index;
  }

  @ViewChild("classScheduler") classScheduler: ClassSchedulerComponent;

  eventOutput = "";

  events: Events = new Events();
  // periods: Period[];
  // sections: Section[];
  // items: Item[];
  // itemCount = 3;
  // sectionCount = 10;

  // Week view
  public scheduleEvents: Events = new Events();
  public schedulePeriods: Period[] = [
    // {
    //   name: "1 day",
    //   timeFramePeriod: 60,
    //   timeFrameOverall: 24,
    //   timeFrameHeaders: ["Do MMM", "HH"],
    //   classes: "period-1day"
    // },
    {
      name: "1 week",
      timeFrameHeaders: ["MMM YYYY", "DD(ddd)"],
      classes: "",
      timeFrameOverall: 1440 * 6,
      timeFramePeriod: 1440,
    },
    {
      name: "2 weeks",
      timeFrameHeaders: ["MMM YYYY", "DD(ddd)"],
      timeFrameHeadersTooltip: ["MMM YYYY", "DD(ddd)"],
      classes: "",
      timeFrameOverall: 1440 * 14,
      timeFramePeriod: 1440,
    },
    // {
    //   name: "3 weeks",
    //   timeFrameHeaders: ["MMM YYYY", "DD(ddd)"],
    //   timeFrameHeadersTooltip: ["MMM YYYY", "DD(ddd)"],
    //   classes: "",
    //   timeFrameOverall: 1440 * 21,
    //   timeFramePeriod: 1440
    // },
    // {
    //   name: "3 days",
    //   timeFramePeriod: 60 * 3,
    //   timeFrameOverall: 60 * 24 * 3,
    //   timeFrameHeaders: ["Do MMM", "HH"],
    //   classes: "period-3day"
    // },

    // {
    //   name: "1 week",
    //   timeFrameHeaders: ["MMM YYYY", "DD(ddd)"],
    //   classes: "",
    //   timeFrameOverall: 1440 * 7,
    //   timeFramePeriod: 1440
    // }
  ];
  public scheduleSections: Section[] = [];
  public scheduleItems: Item[] = [];
  public scheduleItemCount = 3;
  public scheduleSectionCount = 10;

  // Week of class view
  public weekByClassEvents: Events = new Events();
  public weekByClassPeriods: Period[] = [];
  public weekByClassSections: Section[] = [];
  public weekByClassItems: Item[] = [];
  public weekByClassItemCount = 3;
  public weekByClassSectionCount = 10;

  // Day view
  // public dayViewStartDate = moment().startOf("day");
  // public dayViewEndDate = moment().endOf("day");
  // public dayViewEvents: Events = new Events();
  // public dayViewPeriods: Period[] = [];
  // public dayViewSections: Section[] = [
  //   {
  //     id: 0,
  //     title: "Shift",
  //     description: "Shifts"
  //   }
  // ];
  // public dayViewItems: Item[] = [];
  // public dayViewItemCount = 3;
  // public dayViewSectionCount = 10;

  //
  public schedules: Array<ISchedule> = [];

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    public readonly ngxTimeSchedulerService: NgxTimeSchedulerService,
    private readonly schedulesService: SchedulesService,
    private readonly schedulesShiftsService: SchedulesShiftsService
  ) {
    this.segmentIndex = parseInt((this.activatedRoute.snapshot.queryParams as any)?.tab || 0);

    this.events.SectionClickEvent = (section) => {
      this.eventOutput += "\n" + JSON.stringify(section);
    };
    this.events.SectionContextMenuEvent = (section, { x, y }: MouseEvent) => {
      this.eventOutput += "\n" + JSON.stringify(section) + "," + JSON.stringify({ x, y });
    };
    this.events.ItemClicked = (item) => {
      this.eventOutput += "\n" + JSON.stringify(item);
    };
    this.events.ItemContextMenu = (item, { x, y }: MouseEvent) => {
      this.eventOutput += "\n" + JSON.stringify(item) + "," + JSON.stringify({ x, y });
    };
    this.events.ItemDropped = (item) => {
      this.eventOutput += "\n" + JSON.stringify(item);
    };
    this.events.PeriodChange = (start, end) => {
      this.eventOutput += "\n" + JSON.stringify(start) + "," + JSON.stringify(end);
    };
    this.events.ScheduleUpdated = () => {
      console.log("called");
      this.ngOnInit();
    };

    ngxTimeSchedulerService;
  }

  public ngOnInit() {
    // lastValueFrom(this.schedulesService.fetch()).then((res) => {
    this.setScheduleDefaultValue();

    //   console.log("res >>", res);
    //   if (res.success) {
    //     /* Reset value */

    //     const schedules: Array<IStaffSchedule> = res.data;

    //     // let sortedTimeRanges: Array<IScheduleSchedulesShift> = [];
    //     // let sortedShifts: Array<IScheduleSchedulesShift> = [];

    //     // schedules.forEach((schedule, scheduleIndex) => {
    //     //   /* Week By Class */
    //     //   const sortShifts = new Set();
    //     //   const xsortedShifts = schedule.schedulesShifts.filter((shift) => {
    //     //     const key = `${shift.time.from}-${shift.time.to}`;
    //     //     if (!sortShifts.has(key)) {
    //     //       sortShifts.add(key);
    //     //       return true;
    //     //     }
    //     //     return false;
    //     //   });

    //     //   xsortedShifts.forEach((shift) => {
    //     //     sortedShifts.push(shift);
    //     //   });
    //     // });

    //     // sortedTimeRanges = [...sortedShifts.values()].sort((a, b) => {
    //     //   const timeA = FormatTime(a.time.from);
    //     //   const timeB = FormatTime(b.time.from);
    //     //   return timeA.toMillis() - timeB.toMillis();
    //     // });
    //     // console.log("uniqueTimeRanges", sortedShifts, "sortedTimeRanges>>>", sortedTimeRanges);

    //     /* Week By Class - Section */
    //     const sortedTimeRanges: Array<IScheduleSchedulesShift> = SortScheduleShift(schedules);
    //     this.weekByClassSections = [];
    //     sortedTimeRanges.forEach((schedule, sectionIndex: number) => {
    //       // const fromTime = moment(schedule.time.from, "HH:mm").format("hh:mma");
    //       // const toTime = moment(schedule.time.to, "HH:mm").format("hh:mma");
    //       const shiftId = sectionIndex + 1;
    //       this.weekByClassSections.push({
    //         id: shiftId,
    //         title: schedule.timeRangeText,
    //         description: null
    //       });
    //     });

    //     /* Week Sections */
    //     // let sortedSchedules: Array<IStaffSchedule> = [];
    //     // // schedules.forEach((schedule, scheduleIndex) => {
    //     // const sorted = new Set();
    //     // const filteredSorted = schedules.filter((schedule) => {
    //     //   const key = `${schedule.time.from}-${schedule.time.to}`;
    //     //   if (!sorted.has(key)) {
    //     //     sorted.add(key);
    //     //     return true;
    //     //   }
    //     //   return false;
    //     // });
    //     // filteredSorted.forEach((shift) => {
    //     //   sortedSchedules.push(shift);
    //     // });
    //     // // });

    //     // let sortedScheduleTimeRanges: Array<IStaffSchedule> = [...sortedSchedules.values()].sort((a, b) => {
    //     //   const timeA = FormatTime(a.time.from);
    //     //   const timeB = FormatTime(b.time.from);
    //     //   return timeA.toMillis() - timeB.toMillis();
    //     // });

    //     this.scheduleSections = [];
    //     SortSchedule(schedules).forEach((schedule, scheduleIndex: number) => {
    //       const sectionId = scheduleIndex + 1;
    //       this.scheduleSections.push({
    //         title: schedule.title,
    //         description: schedule.timeRangeText,
    //         id: sectionId,
    //         schedule: schedule
    //       });
    //     });

    //     /////////////////
    //     /* ========================= */
    //     this.scheduleItems = [];
    //     this.scheduleSections.forEach((sectionSchedule, scheduleIndex) => {
    //       const schedule = sectionSchedule.schedule;

    //       const sectionId = sectionSchedule.id;
    //       /* TODO: loop the schedule.schedule to display the shifts based on recurring method */
    //       /* start/end = should be based on the generated dates of rrule */
    //       const composedRRule = ComposedRRule({
    //         ...schedule.schedule,
    //         fromDate: DateTime.fromISO(schedule.schedule.fromDate as any).toJSDate(),
    //         fromTime: DateTime.fromISO(schedule.schedule.fromTime as any).toJSDate(),
    //         toDate: DateTime.now().plus({ months: 2 }).toJSDate(),
    //         toTime: DateTime.fromISO(schedule.schedule.toTime as any).toJSDate()
    //       });
    //       console.log("schedule >> ", composedRRule.approximate.all().length);

    //       /* composedRRule */
    //       composedRRule.approximate.all().forEach((date, i) => {
    //         this.scheduleItems.push({
    //           id: i,
    //           sectionID: sectionId,
    //           name: null, //"shift.title",
    //           start: moment(date).startOf("day"),
    //           end: moment(date).endOf("day"),
    //           classes: ""
    //         });

    //         // schedule.schedulesShifts.forEach((shift, shiftsIndex) => {
    //         //   const shiftId = shiftsIndex + 1;

    //         //   const shiftFromTime = moment(shift.time.from, "HH:mm");
    //         //   const shiftToTime = moment(shift.time.to, "HH:mm");
    //         //   this.dayViewItems.push({
    //         //     id: shiftId,
    //         //     sectionID: 0,
    //         //     name: `Total members `,
    //         //     start: moment(date).set({ hours: shiftFromTime.hour(), minute: shiftFromTime.minute() }),
    //         //     end: moment(date).set({ hours: shiftToTime.hour(), minute: shiftToTime.minute() }),
    //         //     classes: ""
    //         //   });
    //         // });
    //       });

    //       this.loadWeekByClass(schedule, composedRRule.approximate.all(), sectionId, sortedTimeRanges);

    //       // Day view
    //       // this.dayViewSections.push({
    //       //   title: schedule.title,
    //       //   description: `${fromTime} - ${toTime}`,
    //       //   id: sectionId
    //       // });
    //     });

    //     this.ngxTimeSchedulerService.refresh();
    //   }
    // });

    lastValueFrom(this.schedulesShiftsService.fetch()).then((res) => {
      const schedulesShifts: Array<IScheduleSchedulesShift> = res.data;

      const sortedTimeRanges: Array<IScheduleSchedulesShift> = SortScheduleShift(schedulesShifts);

      // console.log("sortedTimeRanges", sortedTimeRanges);

      this.weekByClassSections = [];
      sortedTimeRanges.forEach((schedule, sectionIndex: number) => {
        const shiftId = sectionIndex + 1;
        this.weekByClassSections.push({
          id: shiftId,
          title: schedule.timeRangeText,
          description: null,
        });

        // this.loadWeekByClass(schedulesShifts, [], shiftId, sortedTimeRanges);
      });

      console.log("weekByClassSections", this.weekByClassSections);
      // this.weekByClassItems = [{ id: 1, sectionID: 1, name: "Item 1", start: moment().startOf("day"), end: moment().endOf("day"), classes: "" }];

      /* Section Items */
      const timeRangeIndex = (tss: IScheduleSchedulesShift) => {
        return sortedTimeRanges.findIndex((s) => s.time.from === tss.time.from && s.time.to === tss.time.to);
      };

      schedulesShifts.forEach((shift, shiftIndex: number) => {
        const sectionId = timeRangeIndex(shift) + 1;

        const fromTime = moment(shift.time.from, "HH:mm");
        const toTime = moment(shift.time.to, "HH:mm");
        const shiftId = shiftIndex + 1;

        const composedRRule = ComposedRRule({
          ...shift.schedule,
          fromDate: DateTime.fromISO(shift.startDate as any).toJSDate(),
          fromTime: DateTime.fromISO(shift.startDate as any)
            .set({ hour: DateTime.fromFormat(shift.time.from, "HH:mm").hour })
            .toJSDate(),
          toDate: DateTime.now().plus({ months: 2 }).toJSDate(),
          toTime: DateTime.fromISO(shift.schedule.toTime as any)
            .set({ hour: DateTime.fromFormat(shift.time.to, "HH:mm").hour })
            .toJSDate(),
        });

        const rruleDates = composedRRule.approximate.all();

        // console.log("rruleDates", rruleDates);

        rruleDates.forEach((date, rruleIndex: number) => {
          this.weekByClassItems.push({
            id: shiftId,
            sectionID: sectionId,
            name: shift.title,
            start: moment(date).startOf("day"),
            end: moment(date).endOf("day"),
            classes: "",
            shift: shift,
          });
        });
      });

      // this.loadWeekByClass(schedulesShifts, null, 10, sortedTimeRanges);

      setTimeout(() => {
        this.ngxTimeSchedulerService.refresh();
      }, 2000);
    });
  }

  public setScheduleDefaultValue(): void {
    /* Week view */
    this.scheduleEvents = new Events();
    this.schedulePeriods = [
      // {
      //   name: "1 day",
      //   timeFramePeriod: 60,
      //   timeFrameOverall: 24,
      //   timeFrameHeaders: ["Do MMM", "HH"],
      //   classes: "period-1day"
      // },
      {
        name: "1 week",
        timeFrameHeaders: ["MMM YYYY", "DD(ddd)"],
        classes: "",
        timeFrameOverall: 1440 * 6,
        timeFramePeriod: 1440,
      },
      {
        name: "2 weeks",
        timeFrameHeaders: ["MMM YYYY", "DD(ddd)"],
        timeFrameHeadersTooltip: ["MMM YYYY", "DD(ddd)"],
        classes: "",
        timeFrameOverall: 1440 * 14,
        timeFramePeriod: 1440,
      },
      // {
      //   name: "3 weeks",
      //   timeFrameHeaders: ["MMM YYYY", "DD(ddd)"],
      //   timeFrameHeadersTooltip: ["MMM YYYY", "DD(ddd)"],
      //   classes: "",
      //   timeFrameOverall: 1440 * 21,
      //   timeFramePeriod: 1440
      // },
      // {
      //   name: "3 days",
      //   timeFramePeriod: 60 * 3,
      //   timeFrameOverall: 60 * 24 * 3,
      //   timeFrameHeaders: ["Do MMM", "HH"],
      //   classes: "period-3day"
      // },

      // {
      //   name: "1 week",
      //   timeFrameHeaders: ["MMM YYYY", "DD(ddd)"],
      //   classes: "",
      //   timeFrameOverall: 1440 * 7,
      //   timeFramePeriod: 1440
      // }
    ];
    this.scheduleSections = [];
    this.scheduleItems = [];
    this.scheduleItemCount = 3;
    this.scheduleSectionCount = 10;

    // Week of class view
    this.weekByClassEvents = new Events();
    this.weekByClassPeriods = [];
    this.weekByClassSections = [];
    this.weekByClassItems = [];
    this.weekByClassItemCount = 1;
    this.weekByClassSectionCount = 1;

    // Day view
    // this.dayViewStartDate = moment().startOf("day");
    // this.dayViewEndDate = moment().endOf("day");
    // this.dayViewEvents = new Events();
    // this.dayViewPeriods = [];
    // this.dayViewSections = [
    //   {
    //     id: 0,
    //     title: "Shift",
    //     description: "Shifts"
    //   }
    // ];
    // this.dayViewItems = [];
    // this.dayViewItemCount = 3;
    // this.dayViewSectionCount = 10;
  }

  public loadWeekByClass(schedulesShifts: Array<IScheduleSchedulesShift>, rruleDates: Array<Date>, sectionId: number, sortedTimeRanges: Array<IScheduleSchedulesShift>): void {
    const timeRangeIndex = (tss: IScheduleSchedulesShift) => {
      return sortedTimeRanges.findIndex((s) => s.time.from === tss.time.from && s.time.to === tss.time.to);
    };

    /* Section Items */
    schedulesShifts.forEach((shift, shiftIndex: number) => {
      const sectionId = timeRangeIndex(shift) + 1;

      const fromTime = moment(shift.time.from, "HH:mm");
      const toTime = moment(shift.time.to, "HH:mm");
      const shiftId = shiftIndex + 1;

      rruleDates.forEach((date, rruleIndex: number) => {
        this.weekByClassItems.push({
          id: shiftId,
          sectionID: sectionId,
          name: `class: ${shift.classes.name}`,
          start: moment(date).startOf("day"),
          end: moment(date).endOf("day"),
          classes: "",
          shift: shift,
        });
      });
    });
  }

  // addItem() {
  //   this.itemCount++;
  //   this.service.itemPush({
  //     id: this.itemCount,
  //     sectionID: 5,
  //     name: "Item " + this.itemCount,
  //     start: moment().startOf("day"),
  //     end: moment().add(3, "days").endOf("day"),
  //     classes: ""
  //   });
  // }

  // popItem() {
  //   this.service.itemPop();
  // }

  // removeItem() {
  //   this.service.itemRemove(4);
  // }

  // addSection() {
  //   this.sectionCount++;
  //   this.service.sectionPush({
  //     id: this.sectionCount,
  //     title: "Section " + this.sectionCount
  //   });
  // }

  // popSection() {
  //   this.service.sectionPop();
  // }

  // removeSection() {
  //   this.service.sectionRemove(4);
  // }

  // refresh() {
  //   this.service.refresh();
  // }
}
