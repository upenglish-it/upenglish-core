import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { SchedulesShiftsService, StudentsService } from "@isms-core/services";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzModalModule } from "ng-zorro-antd/modal";
import { lastValueFrom } from "rxjs";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzSelectModule } from "ng-zorro-antd/select";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { DateTime } from "luxon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { differenceInCalendarDays } from "date-fns";

@Component({
  selector: "isms-teacher-manage-shift-modal",
  templateUrl: "./teacher-manage-shift-modal.component.html",
  imports: [NgIf, NgFor, JsonPipe, ReactiveFormsModule, NzModalModule, NzButtonModule, NzSelectModule, NzRadioModule, NzInputModule, NzDatePickerModule, ProfilePhotoDirective],
})
export class TeacherManageShiftModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") private readonly onSubmittedEmitter: EventEmitter<void> = new EventEmitter<void>();

  public formGroup = new FormGroup({
    shiftId: new FormControl(null, [Validators.required]),
    date: new FormControl(null, [Validators.required]),
    notes: new FormControl("", [Validators.required]),
  });

  public showModal: boolean = false;

  constructor(
    private readonly schedulesShiftsService: SchedulesShiftsService,
    private readonly studentsService: StudentsService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {}

  public ngOnDestroy(): void {}

  public toggle(): void {
    this.resetFormGroup();
    this.showModal = !this.showModal;
  }

  private resetFormGroup(): void {
    this.formGroup.get("notes").reset();
  }

  public onSubmit(): void {
    lastValueFrom(
      this.schedulesShiftsService.teacherManageShift({
        ...this.formGroup.value,
        date: this.formGroup.value.date,
      })
    ).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Manage Shift", res.message);
      if (res.success) {
        this.toggle();
        this.onSubmittedEmitter.emit();
      }
    });
  }

  public disabledPreviousDate = (current: Date): boolean => differenceInCalendarDays(current, DateTime.now().toJSDate()) < 0;
}
