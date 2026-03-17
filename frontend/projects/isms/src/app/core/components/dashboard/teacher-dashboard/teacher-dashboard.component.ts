import { DatePipe, NgFor, NgIf } from "@angular/common";
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { ICalendarEvent, IScheduleSchedulesShift } from "@isms-core/interfaces";
import { AccountStore } from "@isms-core/ngrx";
import { DashboardAdminService, SchedulesShiftsService } from "@isms-core/services";
import { ComposedRRule } from "@isms-core/utils";
import { DateTime } from "luxon";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzTagModule } from "ng-zorro-antd/tag";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import Calendar, { ISchedule } from "tui-calendar";
import { TeacherManageShiftModalComponent } from "../teacher-manage-shift-modal/teacher-manage-shift-modal.component";
import { NzButtonModule } from "ng-zorro-antd/button";
import { SubSink } from "subsink";
import { NzDividerModule } from "ng-zorro-antd/divider";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { RouterLink } from "@angular/router";
import { environment } from "@isms-env/environment";
import { NzIconModule } from "ng-zorro-antd/icon";

@Component({
  selector: "isms-teacher-dashboard",
  templateUrl: "./teacher-dashboard.component.html",
  imports: [
    NgIf,
    NgFor,
    DatePipe,
    RouterLink,
    NzTagModule,
    NzIconModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzEmptyModule,
    NzSelectModule,
    NzCheckboxModule,
    ProfilePhotoDirective,
    TeacherManageShiftModalComponent,
  ],
})
export class TeacherDashboardComponent implements OnInit, AfterViewInit {
  @ViewChild("tuiCalendarContainer") private tuiCalendarContainer: ElementRef;
  @ViewChild("teacherManageShiftModal") teacherManageShiftModal: TeacherManageShiftModalComponent;
  public tuiCalendar: Calendar = null;
  public scheduleShifts: Array<IScheduleSchedulesShift> = [];
  public assignedClassFormGroup: FormGroup = new FormGroup({
    shiftId: new FormControl("all"),
    calendarView: new FormControl(null),
    focusOnSchedule: new FormControl(true),
  });
  public subSink: SubSink = new SubSink();

  constructor(
    private readonly schedulesShiftsService: SchedulesShiftsService,
    public readonly accountStore: AccountStore
  ) {}

  public ngOnInit(): void {
    lastValueFrom(this.schedulesShiftsService.fetchAssignedShiftToTeacher()).then((res) => {
      console.log("res", res);
      this.scheduleShifts = [];
      if (res.success) {
        this.scheduleShifts = res.data;
        this.loadTeacherScheduleCalendarData();
        this.assignedClassFormGroup.get("calendarView").setValue("week");
      }
    });

    this.assignedClassFormGroup
      .get("shiftId")
      .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
      .subscribe((value) => {
        this.tuiCalendar.clear();
        if (value === "all") {
          this.loadTeacherScheduleCalendarData();
        } else {
          this.setCalendar(value);
        }
      });

    this.assignedClassFormGroup
      .get("focusOnSchedule")
      .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
      .subscribe((value) => {
        if (value) {
          this.tuiCalendar.setDate(DateTime.now().toJSDate());
        }
        console.log("focusOnSchedule ", value);
      });
  }

  public ngAfterViewInit(): void {
    this.loadTeacherScheduleCalendar();
  }

  private setCalendar(shiftId: string): void {
    // this.tuiCalendar.clear();
    const shift = this.scheduleShifts.find((s) => s._id === shiftId);

    const schedule = shift.schedule;

    let recurrenceEndDate = schedule.recurrence?.ends?.endDate || schedule.toDate;
    if (schedule.recurrence.ends.type === "never") {
      recurrenceEndDate = DateTime.now().plus({ years: 3 }).toISODate();
    }

    const recurrence = ComposedRRule({
      ...schedule,
      fromDate: DateTime.fromISO(shift.startDate as any).toJSDate(),
      fromTime: DateTime.fromISO(shift.startDate as any)
        .set({ hour: DateTime.fromFormat(shift.time.from, "HH:mm").hour })
        .toJSDate(),
      toDate: DateTime.fromISO(recurrenceEndDate as any).toJSDate(),
      toTime: DateTime.fromISO(schedule.toTime as any).toJSDate(),
    });

    recurrence.approximate.all().forEach((date) => {
      let bgColor = "#fff1f0";
      switch (shift.type) {
        case "staff-work":
          bgColor = "#fff1f0";
          break;
        case "class-work":
          bgColor = "#fff1f0";
          break;
        case "tutoring-work":
          bgColor = "#fff1f0";
          break;
        case "tapa-work":
          bgColor = "#fff1f0";
          break;
        default:
          bgColor = "#fff1f0";
          break;
      }

      const schedule: ISchedule = {
        raw: { shift: shift, date: date },
        id: shift._id,
        calendarId: shift._id,
        title: shift.title,
        body: shift.title,
        category: "time",
        color: "#ff3823",
        bgColor: bgColor,
        borderColor: "#ff3823",
        dragBgColor: "blue",
        start: date,
        end: date,
      };
      this.tuiCalendar.createSchedules([schedule]);
    });
  }

  public loadTeacherScheduleCalendarData(): void {
    if (this.scheduleShifts.length > 0) {
      this.scheduleShifts.forEach((shift) => this.setCalendar(shift._id));
    } else {
      this.tuiCalendar.clear();
    }
  }

  public loadTeacherScheduleCalendar(): void {
    this.subSink.add(
      this.assignedClassFormGroup.get("calendarView").valueChanges.subscribe((value) => {
        this.tuiCalendar.changeView(value);
      })
    );

    this.tuiCalendar = new Calendar(this.tuiCalendarContainer.nativeElement, {
      usageStatistics: false,
      defaultView: "week",
      isReadOnly: true,
      taskView: false,
      scheduleView: ["day", "time"],
      // week: {
      //   workweek: true
      // },
      // month: {
      //   workweek: true
      // }
    });

    this.tuiCalendar.on({
      clickSchedule: (e) => {
        console.log("clickSchedule", e, DateTime.fromJSDate(e.schedule.start as Date).toISO());
        const shift = e.schedule.raw["shift"] as IScheduleSchedulesShift;
        const date = e.schedule.raw["date"] as Date;

        this.teacherManageShiftModal.formGroup.get("shiftId").setValue(shift._id);
        this.teacherManageShiftModal.formGroup.get("date").setValue(DateTime.fromJSDate(date).toISODate());
        this.teacherManageShiftModal.toggle();
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
      },
    });
  }

  public goToSuperLMS(): void {
    const url = `${environment.superLMS}/authenticate/verify?role=${this.accountStore.account.role}&email=${this.accountStore.account.emailAddresses[0]}`;
    window.open(url, "_blank").focus();
  }
}
