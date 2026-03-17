import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { Component, EventEmitter, Output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ScheduleSelectorComponent } from "@isms-core/components/common/schedule-selector/schedule-selector.component";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { ScheduleFormGroup } from "@isms-core/form-group";
import { SchedulesService } from "@isms-core/services";
import { isEmpty } from "lodash";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzTimePickerModule } from "ng-zorro-antd/time-picker";

@Component({
  selector: "isms-manage-staff-schedule-drawer",
  templateUrl: "./manage-staff-schedule-drawer.component.html",
  imports: [NgIf, ReactiveFormsModule, NzDrawerModule, NzButtonModule, NzSelectModule, NzTimePickerModule, NzInputModule, ScheduleSelectorComponent],
})
export class ManageStaffScheduleDrawerComponent {
  @Output("on-submitted") onSubmitted: EventEmitter<void> = new EventEmitter();
  public staffScheduleFormGroup = new FormGroup({
    _id: new FormControl(null),
    title: new FormControl(null, Validators.required),
    fromTime: new FormControl(null, Validators.required),
    toTime: new FormControl(null, Validators.required),
    schedule: ScheduleFormGroup(),
  });
  public showDrawer: boolean = false;
  public loading: boolean = false;

  constructor(
    private readonly schedulesService: SchedulesService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public toggle(): void {
    this.showDrawer = !this.showDrawer;

    if (this.showDrawer && !isEmpty(this.staffScheduleFormGroup.value._id)) {
      // lastValueFrom(this.schedulesService.fetchById(this.staffScheduleFormGroup.value._id)).then((res) => {
      //   console.log("res", res);
      //   if (res.success) {
      //     this.staffScheduleFormGroup.reset({
      //       _id: res.data._id,
      //       title: res.data.title,
      //       fromTime: DateTime.fromFormat(res.data.time.from, "HH:mm").toJSDate(),
      //       toTime: DateTime.fromFormat(res.data.time.to, "HH:mm").toJSDate()
      //     });
      //     this.scheduleFormGroup.get("fromDate").setValue(DateTime.fromISO(res.data.schedule.fromDate).toJSDate());
      //     this.scheduleFormGroup.get("fromTime").setValue(DateTime.fromISO(res.data.schedule.fromTime).toJSDate());
      //     this.scheduleFormGroup.get("fromTimezone").setValue(res.data.schedule.fromTimezone);
      //     this.scheduleFormGroup.get("toDate").setValue(DateTime.fromISO(res.data.schedule.toDate).toJSDate());
      //     this.scheduleFormGroup.get("toTime").setValue(DateTime.fromISO(res.data.schedule.toTime).toJSDate());
      //     this.scheduleFormGroup.get("toTimezone").setValue(res.data.schedule.toTimezone);
      //     this.scheduleFormGroup.get("allDay").setValue(res.data.schedule.allDay);
      //     this.scheduleFormGroup.get("recurrence").get("enable").setValue(res.data.schedule.recurrence.enable);
      //     this.scheduleFormGroup.get("recurrence").get("value").setValue(res.data.schedule.recurrence.value);
      //     this.scheduleFormGroup.get("recurrence").get("freq").setValue(res.data.schedule.recurrence.freq);
      //     this.scheduleFormGroup.get("recurrence").get("interval").setValue(res.data.schedule.recurrence.interval);
      //     this.scheduleFormGroup.get("recurrence").get("byweekday").setValue(res.data.schedule.recurrence.byweekday);
      //     this.scheduleFormGroup.get("recurrence").get("bymonth").setValue(res.data.schedule.recurrence.bymonth);
      //     this.scheduleFormGroup.get("recurrence").get("ends").get("type").setValue(res.data.schedule.recurrence.ends.type);
      //     this.scheduleFormGroup.get("recurrence").get("ends").get("endDate").setValue(res.data.schedule.recurrence.ends.endDate);
      //     this.scheduleFormGroup.get("recurrence").get("ends").get("count").setValue(res.data.schedule.recurrence.ends.count);
      //   }
      // });
    }
  }

  public onSubmit(): void {
    this.staffScheduleFormGroup.markAllAsTouched();

    console.log(JSON.stringify(this.staffScheduleFormGroup.value, null, 2));
    console.log(this.staffScheduleFormGroup);
    // if (this.staffScheduleFormGroup.value._id) {
    //   if (this.staffScheduleFormGroup.valid) {
    //     this.loading = true;
    //     lastValueFrom(
    //       this.schedulesService.updateById(
    //         {
    //           title: this.staffScheduleFormGroup.value.title,
    //           time: {
    //             from: DateTime.fromJSDate(this.staffScheduleFormGroup.value.fromTime).toFormat("HH:mm"),
    //             to: DateTime.fromJSDate(this.staffScheduleFormGroup.value.toTime).toFormat("HH:mm")
    //           },
    //           schedule: this.staffScheduleFormGroup.value.schedule
    //         },
    //         this.staffScheduleFormGroup.value._id
    //       )
    //     ).then((res) => {
    //       this.loading = false;
    //       if (res.success) {
    //         this.showDrawer = false;
    //         this.onSubmitted.emit();
    //       }
    //       this.nzNotificationService.create(res.success ? "success" : "error", "Update Schedule", res.message, { nzPlacement: "bottomRight" });
    //     });
    //   }
    // } else {
    //   if (this.staffScheduleFormGroup.valid) {
    //     this.loading = true;
    //     lastValueFrom(
    //       this.schedulesService.create({
    //         title: this.staffScheduleFormGroup.value.title,
    //         time: {
    //           from: DateTime.fromJSDate(this.staffScheduleFormGroup.value.fromTime).toFormat("HH:mm"),
    //           to: DateTime.fromJSDate(this.staffScheduleFormGroup.value.toTime).toFormat("HH:mm")
    //         },
    //         schedule: this.staffScheduleFormGroup.value.schedule
    //       })
    //     ).then((res) => {
    //       this.loading = false;
    //       if (res.success) {
    //         this.showDrawer = false;
    //         this.onSubmitted.emit();
    //       }
    //       this.nzNotificationService.create(res.success ? "success" : "error", "Create Schedule", res.message, { nzPlacement: "bottomRight" });
    //     });
    //   }
    // }
  }

  public get scheduleFormGroup(): FormGroup {
    return this.staffScheduleFormGroup.get("schedule") as FormGroup;
  }
}
