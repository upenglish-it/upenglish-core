import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { ClassesService, StudentsService } from "@isms-core/services";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzModalModule } from "ng-zorro-antd/modal";
import { IAccount, IClassStudent, IClassStudentRecord } from "@isms-core/interfaces";
import { debounceTime, lastValueFrom } from "rxjs";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { NgFor, NgIf } from "@angular/common";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzSelectModule } from "ng-zorro-antd/select";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { DateTime } from "luxon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { differenceInCalendarDays } from "date-fns";
import { SubSink } from "subsink";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzAlertModule } from "ng-zorro-antd/alert";

@Component({
  selector: "isms-mark-attendance-modal",
  templateUrl: "./mark-attendance-modal.component.html",
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    NzModalModule,
    NzButtonModule,
    NzCheckboxModule,
    NzSelectModule,
    NzRadioModule,
    NzInputModule,
    NzDatePickerModule,
    NzAlertModule,
    ProfilePhotoDirective,
  ],
})
export class MarkAttendanceModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") private readonly onSubmittedEmitter: EventEmitter<void> = new EventEmitter<void>();

  public formGroup = new FormGroup({
    studentClassId: new FormControl("", [Validators.required]),
    // studentTuitionAttendanceId: new FormControl(""),
    date: new FormControl(DateTime.now().toJSDate(), [Validators.required]),
    studentIds: new FormControl([], [Validators.required]),
    studentIdsWithClass: new FormControl([], [Validators.required]),
    status: new FormControl("present", [Validators.required]),
    notes: new FormControl(""),
    offDayRestriction: new FormControl(false),
  });
  private readonly subSink: SubSink = new SubSink();
  public showModal: boolean = false;
  public students: Array<IAccount> = [];
  public classes: Array<any> = [];
  public record: IClassStudentRecord = null;
  public viewState: "initial" | "updating" = "initial";

  constructor(
    private readonly classesService: ClassesService,
    private readonly studentsService: StudentsService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {
    this.subSink.add(
      this.formGroup
        .get("status")
        .valueChanges.pipe(debounceTime(100))
        .subscribe((value) => {
          if (value === "off-day") {
            this.formGroup.get("offDayRestriction").addValidators([Validators.requiredTrue]);
          } else {
            this.formGroup.get("offDayRestriction").clearValidators();
          }
          this.formGroup.get("offDayRestriction").updateValueAndValidity();
        })
    );

    lastValueFrom(
      this.studentsService.fetch({
        limit: 5000,
        customQuery: JSON.stringify({
          $or: [
            { official: true, won: false },
            { official: true, won: true },
            { official: false, won: true },
          ],
        }),
      })
    ).then((res) => {
      this.students = res.success ? res.data : [];
    });

    lastValueFrom(this.classesService.fetch()).then((res) => {
      this.classes = res.success ? res.data : [];
    });
  }

  public ngOnDestroy(): void {}

  public async loadData(): Promise<void> {
    lastValueFrom(
      this.classesService.attendanceStudents({
        classId: this.formGroup.value.studentClassId,
        date: DateTime.fromJSDate(this.formGroup.value.date).toFormat("MM-yyyy"),
      })
    ).then((res) => {
      const studentsInClass: Array<IClassStudent> = res.success ? res.data.items : [];
      this.students = studentsInClass.map((student) => student.account);
      if (res.success) {
        this.toggle();
      }
    });
  }

  public toggle(): void {
    this.resetFormGroup();
    this.showModal = !this.showModal;
  }

  private resetFormGroup(): void {
    this.formGroup.get("notes").reset();
  }

  public onSubmit(): void {
    this.viewState = "updating";
    console.log("studentIdsWithClass >> ", this.formGroup.value);
    lastValueFrom(
      this.classesService.markAttendance({
        records: this.formGroup.value.studentIdsWithClass.map((studentIdsWithClass) => {
          console.log("studentIdsWithClassdddd", studentIdsWithClass);
          return {
            studentId: studentIdsWithClass.studentId,
            studentClassId: this.formGroup.value.studentClassId,
            studentTuitionAttendanceId: studentIdsWithClass.studentTuitionAttendanceId,
            day: DateTime.fromJSDate(this.formGroup.value.date).day,
            month: DateTime.fromJSDate(this.formGroup.value.date).month,
            year: DateTime.fromJSDate(this.formGroup.value.date).year,
            hour: DateTime.now().hour,
            minute: DateTime.now().minute,
            ...(this.formGroup.value.status === "absent-with-notice" || this.formGroup.value.status === "off-day" ? { notes: this.formGroup.value.notes } : null),
            status: this.formGroup.value.status,
          };
        }),
      })
    )
      .then((res) => {
        this.nzNotificationService.create(res.success ? "success" : "error", "Mark Attendance", res.message);
        if (res.success) {
          this.toggle();
          this.onSubmittedEmitter.emit();
        }
      })
      .finally(() => {
        this.viewState = "initial";
      });
  }

  public disabledPreviousDate = (current: Date): boolean => differenceInCalendarDays(current, DateTime.now().toJSDate()) < 0;
}
