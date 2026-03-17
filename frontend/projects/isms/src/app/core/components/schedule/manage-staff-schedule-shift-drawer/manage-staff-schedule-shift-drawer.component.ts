import { JsonPipe, NgClass, NgFor, NgIf, NgStyle } from "@angular/common";
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from "@angular/core";
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ScheduleSelectorComponent } from "@isms-core/components/common/schedule-selector/schedule-selector.component";
import { Hours, ScheduleColorIndicator } from "@isms-core/constants";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { ScheduleFormGroup, ShiftFormGroup, ShiftStaffFormGroup } from "@isms-core/form-group";
import { IAccount, ICalendarEvent, IClass, ISchedule } from "@isms-core/interfaces";
import { ClassesService, SchedulesService, SchedulesShiftsService, StaffsService } from "@isms-core/services";
import { ArrayRange, SortSchedule } from "@isms-core/utils";
import { isElement, isEmpty, range, rangeRight } from "lodash";
import { DateTime } from "luxon";
import * as moment from "moment";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzDividerModule } from "ng-zorro-antd/divider";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzTableModule } from "ng-zorro-antd/table";
import { NzTimePickerModule } from "ng-zorro-antd/time-picker";
import { lastValueFrom } from "rxjs";
import Calendar from "tui-calendar";
import { differenceInCalendarDays } from "date-fns";
import { AccountStore } from "@isms-core/ngrx";
import { NzModalService } from "ng-zorro-antd/modal";

@Component({
  selector: "isms-manage-staff-schedule-shift-drawer",
  templateUrl: "./manage-staff-schedule-shift-drawer.component.html",
  imports: [
    NgIf,
    NgFor,
    NgClass,
    JsonPipe,
    NgStyle,
    ReactiveFormsModule,
    NzDrawerModule,
    NzButtonModule,
    NzSelectModule,
    NzCheckboxModule,

    NzTimePickerModule,
    NzDatePickerModule,
    NzTableModule,
    NzPopconfirmModule,
    NzInputModule,
    NzCollapseModule,
    NzIconModule,
    NzDividerModule,
    ScheduleSelectorComponent,
    ProfilePhotoDirective,
  ],
})
export class ManageStaffScheduleShiftDrawerComponent implements OnInit {
  @ViewChild("tuiCalendarContainer") private tuiCalendarContainer: ElementRef;
  @Output("on-submitted") onSubmitted: EventEmitter<void> = new EventEmitter();
  public shiftFormGroup: FormGroup = ShiftFormGroup();
  public showDrawer: boolean = false;
  public loading: boolean = false;
  public statusLoading: boolean = false;
  public currentStatus: string = null;
  // public schedules: Array<IStaffSchedule> = [];
  public teachers: Array<IAccount> = [];
  public staffs: Array<IAccount> = [];
  public receptionists: Array<IAccount> = [];
  public classes: Array<IClass> = [];
  public scheduleColorIndicator = ScheduleColorIndicator;

  panels = [
    {
      active: true,
      name: "Sep 10 - Sep 20, 2023",
      disabled: false,
    },
    {
      active: false,
      disabled: false,
      name: "This is panel header 2",
    },
    {
      active: false,
      disabled: false,
      name: "This is panel header 3",
    },
  ];

  teachersPanel = [
    {
      active: true,
      name: "John Doe",
      disabled: false,
    },
    {
      active: false,
      disabled: false,
      name: "Jane Cooper",
    },
    {
      active: false,
      disabled: false,
      name: "Alex Zander",
    },
  ];

  public tuiCalendar: Calendar = null;

  constructor(
    private readonly nzNotificationService: NzNotificationService,
    private readonly staffsService: StaffsService,
    private readonly classesService: ClassesService,
    private readonly schedulesService: SchedulesService,
    private readonly schedulesShiftsService: SchedulesShiftsService,
    public readonly account: AccountStore,
    private readonly nzModalService: NzModalService
  ) {}

  public ngOnInit(): void {
    lastValueFrom(this.staffsService.fetch({ includeMe: true })).then((res) => {
      if (res.success) {
        console.log("res.data", res.data);
        const staffs: Array<IAccount> = res.data;
        this.teachers = staffs.filter((staff) => staff.role === "teacher");
        this.staffs = staffs.filter((staff) => staff.role === "marketing" || staff.role === "receptionist" || staff.role === "teacher");
        this.receptionists = staffs.filter((staff) => staff.role === "receptionist");
      }
    });
    lastValueFrom(this.classesService.fetch()).then((res) => {
      if (res.success) {
        this.classes = res.data;
      }
    });
    this.shiftFormGroup.get("type").valueChanges.subscribe((type) => {
      if (type.value === "staff-work") {
        // _id: new FormControl(null),
        // type: new FormControl(null, Validators.required),
        // scheduleId: new FormControl(null, Validators.required),
        // staffs: new FormArray([]),
        // careTakerId: new FormControl(null, Validators.required),
        // classId: new FormControl(null, Validators.required),
        // startDate: new FormControl(null, Validators.required),
        // room: new FormControl(null, Validators.required),
        // fromTime: new FormControl(null, Validators.required),
        // toTime: new FormControl(null, Validators.required)
        this.shiftFormGroup.get("classId").removeValidators([Validators.required]);
        this.shiftFormGroup.get("classId").updateValueAndValidity();

        this.shiftFormGroup.get("room").removeValidators([Validators.required]);
        this.shiftFormGroup.get("room").updateValueAndValidity();
      }
    });
  }

  public toggle(): void {
    this.showDrawer = !this.showDrawer;

    if (this.showDrawer && !isEmpty(this.shiftFormGroup.value._id)) {
      lastValueFrom(this.schedulesShiftsService.fetchById(this.shiftFormGroup.value._id)).then((res) => {
        console.log("res", res.data.status);
        if (res.success) {
          const type = ScheduleColorIndicator.find((sci) => sci.value === res.data.type);

          const fromTime = DateTime.fromFormat(res.data.time.from, "HH:mm");
          const toTime = DateTime.fromFormat(res.data.time.to, "HH:mm");

          this.shiftFormGroup.reset({
            _id: res.data._id,
            title: res.data.title,
            type: type,
            // scheduleId: res.data.schedules._id,
            careTakerId: res.data.careTaker?._id || null,
            classId: res.data.classes?._id || null,
            startDate: res.data.startDate,
            room: res.data.room,
            fromTime: fromTime.toJSDate(),
            toTime: toTime.toJSDate(),
            homeworkCheckerId: res.data.homeworkChecker?._id || null,
          });

          const staffs = res.data.staffs as Array<{ id: string; schedule: ISchedule }>;
          this.staffsFormArray.clear();
          staffs.forEach((staff) => {
            const formGroup = ShiftStaffFormGroup();
            formGroup.get("id").setValue(staff.id);
            // staff.schedule.fromDate = DateTime.fromISO(staff.schedule.fromDate as any as string, { zone: "UTC" }).toJSDate();
            formGroup.get("schedule").patchValue(staff.schedule);
            this.staffsFormArray.push(formGroup);
          });

          // this.scheduleFormGroup.get("fromDate").setValue(DateTime.fromISO(res.data.schedule.fromDate).toJSDate());
          // this.scheduleFormGroup.get("fromTime").setValue(DateTime.fromISO(res.data.schedule.fromTime).toJSDate());
          // this.scheduleFormGroup.get("fromTimezone").setValue(res.data.schedule.fromTimezone);
          // this.scheduleFormGroup.get("toDate").setValue(DateTime.fromISO(res.data.schedule.toDate).toJSDate());
          // this.scheduleFormGroup.get("toTime").setValue(DateTime.fromISO(res.data.schedule.toTime).toJSDate());
          // this.scheduleFormGroup.get("toTimezone").setValue(res.data.schedule.toTimezone);
          // this.scheduleFormGroup.get("allDay").setValue(res.data.schedule.allDay);
          // this.scheduleFormGroup.get("recurrence").get("enable").setValue(res.data.schedule.recurrence.enable);
          // this.scheduleFormGroup.get("recurrence").get("value").setValue(res.data.schedule.recurrence.value);
          // this.scheduleFormGroup.get("recurrence").get("freq").setValue(res.data.schedule.recurrence.freq);
          // this.scheduleFormGroup.get("recurrence").get("interval").setValue(res.data.schedule.recurrence.interval);
          // this.scheduleFormGroup.get("recurrence").get("byweekday").setValue(res.data.schedule.recurrence.byweekday);
          // this.scheduleFormGroup.get("recurrence").get("bymonth").setValue(res.data.schedule.recurrence.bymonth);
          // this.scheduleFormGroup.get("recurrence").get("ends").get("type").setValue(res.data.schedule.recurrence.ends.type);
          // this.scheduleFormGroup.get("recurrence").get("ends").get("endDate").setValue(res.data.schedule.recurrence.ends.endDate);
          // this.scheduleFormGroup.get("recurrence").get("ends").get("count").setValue(res.data.schedule.recurrence.ends.count);

          // this.loadTeacherScheduleCalendar();

          this.shiftScheduleFormGroup.get("fromDate").setValue(DateTime.fromISO(res.data.schedule.fromDate).toJSDate());
          this.shiftScheduleFormGroup.get("fromTime").setValue(DateTime.fromISO(res.data.schedule.fromTime).toJSDate());
          this.shiftScheduleFormGroup.get("fromTimezone").setValue(res.data.schedule.fromTimezone);
          this.shiftScheduleFormGroup.get("toDate").setValue(DateTime.fromISO(res.data.schedule.toDate).toJSDate());
          this.shiftScheduleFormGroup.get("toTime").setValue(DateTime.fromISO(res.data.schedule.toTime).toJSDate());
          this.shiftScheduleFormGroup.get("toTimezone").setValue(res.data.schedule.toTimezone);
          this.shiftScheduleFormGroup.get("allDay").setValue(res.data.schedule.allDay);
          this.shiftScheduleFormGroup.get("recurrence").get("enable").setValue(res.data.schedule.recurrence.enable);
          this.shiftScheduleFormGroup.get("recurrence").get("value").setValue(res.data.schedule.recurrence.value);
          this.shiftScheduleFormGroup.get("recurrence").get("freq").setValue(res.data.schedule.recurrence.freq);
          this.shiftScheduleFormGroup.get("recurrence").get("interval").setValue(res.data.schedule.recurrence.interval);
          this.shiftScheduleFormGroup.get("recurrence").get("byweekday").setValue(res.data.schedule.recurrence.byweekday);
          this.shiftScheduleFormGroup.get("recurrence").get("bymonth").setValue(res.data.schedule.recurrence.bymonth);
          this.shiftScheduleFormGroup.get("recurrence").get("ends").get("type").setValue(res.data.schedule.recurrence.ends.type);
          this.shiftScheduleFormGroup.get("recurrence").get("ends").get("endDate").setValue(res.data.schedule.recurrence.ends.endDate);
          this.shiftScheduleFormGroup.get("recurrence").get("ends").get("count").setValue(res.data.schedule.recurrence.ends.count);
          this.currentStatus = res.data.status || "ongoing";
        }
      });
    }
  }

  public loadTeacherScheduleCalendar(): void {
    this.tuiCalendar = new Calendar(this.tuiCalendarContainer.nativeElement, {
      usageStatistics: false,
      defaultView: "month",
      isReadOnly: false,
    });

    this.tuiCalendar.on({
      clickSchedule: (e) => {
        console.log("clickSchedule", e);
        const event = e.schedule.raw["event"] as ICalendarEvent;
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

  public toggleStatus(): void {
    const id = this.shiftFormGroup.value._id;
    if (!id || this.statusLoading) return;
    const newStatus = this.currentStatus === "ongoing" ? "stopped" : "ongoing";
    this.statusLoading = true;
    lastValueFrom(this.schedulesShiftsService.updateById({ status: newStatus }, id))
      .then((res) => {
        if (res.success) {
          this.currentStatus = newStatus;
          this.onSubmitted.emit();
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Update Status", res.message, { nzPlacement: "bottomRight" });
      })
      .finally(() => {
        this.statusLoading = false;
      });
  }

  public onSubmit(): void {
    this.shiftFormGroup.markAllAsTouched();
    if (this.shiftFormGroup.value._id) {
      if (this.shiftFormGroup.valid) {
        this.loading = true;
        lastValueFrom(
          this.schedulesShiftsService.updateById(
            {
              type: this.shiftFormGroup.value.type.value,
              title: this.shiftFormGroup.value.title,
              // scheduleId: this.shiftFormGroup.value.scheduleId,
              schedule: this.shiftFormGroup.value.schedule,
              // staffId: this.shiftFormGroup.value.staffId,
              staffs: this.shiftFormGroup.value.staffs,
              careTakerId: this.shiftFormGroup.value.careTakerId,
              classId: this.shiftFormGroup.value.classId,
              startDate: this.shiftFormGroup.value.startDate,
              room: this.shiftFormGroup.value.room,
              time: {
                from: DateTime.fromJSDate(this.shiftFormGroup.value.fromTime).toFormat("HH:mm"),
                to: DateTime.fromJSDate(this.shiftFormGroup.value.toTime).toFormat("HH:mm"),
              },
              homeworkCheckerId: this.shiftFormGroup.value.homeworkCheckerId,
            },
            this.shiftFormGroup.value._id
          )
        ).then((res) => {
          this.loading = false;
          if (res.success) {
            this.showDrawer = false;
            this.onSubmitted.emit();
          }
          this.nzNotificationService.create(res.success ? "success" : "error", "Update Shift", res.message, { nzPlacement: "bottomRight" });
        });
      }
    } else {
      if (this.shiftFormGroup.valid) {
        this.loading = true;
        lastValueFrom(
          this.schedulesShiftsService.create({
            type: this.shiftFormGroup.value.type.value,
            title: this.shiftFormGroup.value.title,
            // scheduleId: this.shiftFormGroup.value.scheduleId,
            // staffId: this.shiftFormGroup.value.staffId,
            schedule: this.shiftFormGroup.value.schedule,
            staffs: this.shiftFormGroup.value.staffs,
            careTakerId: this.shiftFormGroup.value.careTakerId,
            classId: this.shiftFormGroup.value.classId,
            startDate: this.shiftFormGroup.value.startDate,
            room: this.shiftFormGroup.value.room,
            time: {
              from: DateTime.fromJSDate(this.shiftFormGroup.value.fromTime).toFormat("HH:mm"),
              to: DateTime.fromJSDate(this.shiftFormGroup.value.toTime).toFormat("HH:mm"),
            },
            homeworkCheckerId: this.shiftFormGroup.value.homeworkCheckerId,
          })
        ).then((res) => {
          this.loading = false;
          if (res.success) {
            this.showDrawer = false;
            this.onSubmitted.emit();
          }
          this.nzNotificationService.create(res.success ? "success" : "error", "Create Shift", res.message, { nzPlacement: "bottomRight" });
        });
      }
    }
  }

  public deleteShift(): void {
    this.nzModalService.confirm({
      nzBodyStyle: { "padding-left": "16px", "padding-right": "16px", "padding-bottom": "10px", "padding-top": "16px" },
      nzTitle: "Deleting the this will also delete all the enrolled students associated to this schedule? This action cannot be undone.",
      nzOkText: "Confirm",
      nzOkType: "primary",
      nzOkDanger: true,
      nzCancelText: "No, Keep it",
      nzOnCancel: () => {},
      nzOnOk: () => {
        lastValueFrom(this.schedulesShiftsService.delete(this.shiftFormGroup.value._id)).then((res) => {
          if (res.success) {
            this.showDrawer = false;
            this.onSubmitted.emit();
            location.reload();
          }
          this.nzNotificationService.create(res.success ? "success" : "error", "Delete Shift", res.message, { nzPlacement: "bottomRight" });
        });
      },
    });
  }

  public disabledHours = (): number[] => {
    // const filteredSchedule = this.schedules.find((s) => s._id === this.shiftFormGroup.value.scheduleId);
    // if (!isEmpty(filteredSchedule)) {
    //   const fromTime = moment(filteredSchedule.time.from, "HH:mm");
    //   const toTime = moment(filteredSchedule.time.to, "HH:mm");
    //   const hours = ArrayRange(fromTime.hour(), toTime.hour());
    //   return Hours.filter((h) => !hours.includes(h));
    // }
    return [];
  };

  public disabledMinutes(hour: number): number[] {
    // const filteredSchedule = this.schedules.find((s) => s._id === this.shiftFormGroup.value.scheduleId);
    // if (!isEmpty(filteredSchedule)) {
    //   const fromTime = moment(filteredSchedule.time.from, "HH:mm");
    //   const toTime = moment(filteredSchedule.time.to, "HH:mm");
    //   // schedule["timeRangeText"] = `${fromTime} - ${toTime}`;
    //   console.log(fromTime.hour(), toTime.hour());
    //   const hours = ArrayRange(fromTime.hour(), toTime.hour());
    //   console.log("hours", hours);
    //   return [];
    // }
    // console.log("hour", hour);
    return [];
  }

  expandSet = new Set<number>();
  onExpandChange(id: number, checked: boolean): void {
    if (checked) {
      this.expandSet.add(id);
    } else {
      this.expandSet.delete(id);
    }
  }

  public addStaff(): void {
    const formGroup = ShiftStaffFormGroup();
    this.staffsFormArray.push(formGroup);
  }

  public get staffsFormArray(): FormArray {
    return this.shiftFormGroup.get("staffs") as FormArray;
  }

  public staffScheduleFormGroup(index: number): FormGroup {
    return this.staffsFormArray.controls[index].get("schedule") as FormGroup;
  }

  public toFormGroup(formGroup: AbstractControl): FormGroup {
    return formGroup as FormGroup;
  }

  public disabledPreviousDate = (current: Date): boolean => differenceInCalendarDays(current, DateTime.now().toJSDate()) < 0;

  public get shiftScheduleFormGroup(): FormGroup {
    return this.shiftFormGroup.get("schedule") as FormGroup;
  }
}
