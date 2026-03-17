import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { Component, EventEmitter, OnInit, Output } from "@angular/core";
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { INameValue, IScheduleSchedulesShift } from "@isms-core/interfaces";
import { LeavesService, SchedulesShiftsService } from "@isms-core/services";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzSelectModule } from "ng-zorro-antd/select";
import { lastValueFrom } from "rxjs";
import { isEqual } from "date-fns";
import { ComposedRRule } from "@isms-core/utils";
import { DateTime } from "luxon";
import { LeaveTypes } from "@isms-core/constants";

@Component({
  selector: "isms-manage-leave-modal",
  templateUrl: "./manage-leave-modal.component.html",
  imports: [NgIf, NgFor, JsonPipe, ReactiveFormsModule, NzModalModule, NzInputModule, NzButtonModule, NzIconModule, NzDatePickerModule, NzSelectModule],
})
export class ManageLeaveModalComponent implements OnInit {
  @Output("on-saved") onSaved: EventEmitter<void> = new EventEmitter<void>();
  public showDrawer: boolean = false;
  public loading: boolean = false;

  public leaveFormGroup: FormGroup = new FormGroup({
    dates: new FormArray(
      [
        new FormGroup({
          date: new FormControl(null, Validators.required),
        }),
      ],
      Validators.required
    ),
    notes: new FormControl(null, Validators.required),
    type: new FormControl("pto", Validators.required),
    hours: new FormControl(1, Validators.required),
    payable: new FormControl("paid", Validators.required),
  });

  public leaveTypes: Array<INameValue> = LeaveTypes;

  public staffShifts: Array<IScheduleSchedulesShift> = [];
  public recurrenceDates: Array<Date> = [];

  constructor(
    private readonly nzNotificationService: NzNotificationService,
    private readonly leavesService: LeavesService,
    private readonly schedulesShiftsService: SchedulesShiftsService
  ) {}

  public ngOnInit(): void {
    lastValueFrom(this.schedulesShiftsService.fetchByStaff()).then((res) => {
      this.staffShifts = res.success ? res.data : [];
      // this.recurrences = ComposedRRule(this.staffShifts);
      this.staffShifts.forEach((shift) => {
        // if (shift.schedules.schedule) {

        const composedRRule = ComposedRRule({
          ...shift.schedule,
          fromDate: DateTime.fromISO(shift.schedule.fromDate as any).toJSDate(),
          fromTime: DateTime.fromISO(shift.schedule.fromTime as any).toJSDate(),
          toDate: DateTime.now().plus({ months: 2 }).toJSDate(),
          toTime: DateTime.fromISO(shift.schedule.toTime as any).toJSDate(),
        });

        this.recurrenceDates.push(...this.recurrenceDates, ...composedRRule.approximate.all());

        // }
      });
    });
  }

  public toggle(): void {
    this.showDrawer = !this.showDrawer;
    if (this.showDrawer) {
      this.leaveFormGroup.reset();
    }
  }

  public onSubmit(): void {
    this.leaveFormGroup.markAllAsTouched();
    if (this.leaveFormGroup.valid) {
      this.loading = true;
      // if (this.leaveFormGroup.value._id) {
      //   lastValueFrom(this.branchesService.update({ name: this.formGroup.value.name, address: this.formGroup.value.address }, this.formGroup.value._id)).then((res) => {
      //     if (res.success) {
      //       this.toggle();
      //       this.onSaved.emit();
      //       this.nzNotificationService.success("Update Branch", res.message);
      //     } else {
      //       this.nzNotificationService.error("Update Branch", res.message);
      //     }
      //   });
      // } else {
      lastValueFrom(
        this.leavesService.addStaffRequest({
          dates: this.leaveFormGroup.value.dates.map((d: { date: Date }) => {
            return {
              date: d.date.toISOString().split("T", 1)[0],
            };
          }),
          notes: this.leaveFormGroup.value.notes,
          hours: this.leaveFormGroup.value.hours,
          payable: this.leaveFormGroup.value.payable,
          type: this.leaveFormGroup.value.type,
        })
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.onSaved.emit();
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Request Leave", res.message);
      });
      // }
    }
  }

  public addDate(): void {
    this.datesFormArray.push(
      new FormGroup({
        date: new FormControl(null, Validators.required),
      })
    );
  }

  public toFormGroup(formGroup: AbstractControl): FormGroup {
    return formGroup as FormGroup;
  }

  public get datesFormArray(): FormArray {
    return this.leaveFormGroup.get("dates") as FormArray;
  }

  public disabledDate = (current: Date): boolean => {
    const equalDate = this.recurrenceDates.find((date) => isEqual(current, date));
    console.log("equalDate ", equalDate);
    return false;
  };
}
