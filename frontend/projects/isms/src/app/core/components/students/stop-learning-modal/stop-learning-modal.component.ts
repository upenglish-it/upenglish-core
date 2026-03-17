import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { ClassesService, NGRXService, NotificationsService } from "@isms-core/services";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzModalModule } from "ng-zorro-antd/modal";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { onBackgroundMessage } from "firebase/messaging/sw";
import { environment } from "@isms-env/environment";
import { isEmpty } from "lodash";
import { SubSink } from "subsink";
import { IAccount, IClassStudentRecord } from "@isms-core/interfaces";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { NgClass, NgFor, NgIf } from "@angular/common";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { FormattedCurrencyPipe } from "@isms-core/pipes";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { DateTime } from "luxon";
import { NzAlertModule } from "ng-zorro-antd/alert";

@Component({
  selector: "isms-stop-learning-modal",
  templateUrl: "./stop-learning-modal.component.html",
  imports: [NgIf, NgFor, NgClass, ReactiveFormsModule, NzModalModule, NzButtonModule, NzDatePickerModule, NzAlertModule, FormattedCurrencyPipe],
})
export class StopLearningModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") private readonly onSubmittedEmitter: EventEmitter<void> = new EventEmitter<void>();
  private readonly subSink: SubSink = new SubSink();

  public formGroup = new FormGroup({
    classId: new FormControl("", [Validators.required]),
    studentClassId: new FormControl("", [Validators.required]),
    studentId: new FormControl("", [Validators.required]),
    reason: new FormControl("", [Validators.required]),
    stoppedDate: new FormControl(null, [Validators.required]),
  });
  public showModal: boolean = false;
  public stopLearning: StopLearningI = null;
  public unpaidDaysInterval: Array<{ date: DateTime; year: number; month: number; days: Array<{ enable: boolean; included: boolean; date: DateTime }> }> = [];
  public offDaysMessage: string = null;
  public viewState: "initial" | "submitting" = "initial";

  constructor(
    private readonly classesService: ClassesService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {
    this.subSink.add(
      this.formGroup
        .get("stoppedDate")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(300))
        .subscribe((value) => {
          this.loadRefund();
        })
    );
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  public toggle(): void {
    this.showModal = !this.showModal;
    if (this.showModal) {
      this.formGroup.get("stoppedDate").setValue(null, { emitEvent: false });
      this.loadRefund();
    }
  }

  private loadRefund(): void {
    this.unpaidDaysInterval = [];
    this.stopLearning = null;
    if (this.formGroup.value.stoppedDate) {
      lastValueFrom(
        this.classesService.stopLearning(
          {
            classId: this.formGroup.value.classId,
            studentId: this.formGroup.value.studentId,
            reason: this.formGroup.value.reason,
            action: "request",
            stoppedDate: DateTime.fromJSDate(this.formGroup.value.stoppedDate).toISODate(),
          },
          this.formGroup.value.studentClassId
        )
      ).then((res) => {
        if (res.success) {
          this.stopLearning = res.data;

          this.stopLearning.proceedingDates.previousPayments
            .filter((r) => !r.paid && r.enable && r.included)
            .forEach((record, i) => {
              const paymentDate = DateTime.fromObject({ day: record.day, month: record.month, year: record.year });

              const isExistIndex = this.unpaidDaysInterval.findIndex((d) => d.month === record.month && d.year === record.year);

              if (isExistIndex === -1) {
                let days = [{ ...record, date: paymentDate }];
                this.unpaidDaysInterval.push({ date: paymentDate, year: record.year, month: record.month, days: days });
              } else {
                this.unpaidDaysInterval[isExistIndex].days.push({ ...record, date: paymentDate });
              }
            });

          this.offDaysMessage = this.stopLearning.offDays.length
            ? "The tuition of these Off Day(s) " +
              this.stopLearning.offDays
                .map((record) => {
                  const paymentDate = DateTime.fromObject({ day: record.day, month: record.month, year: record.year });
                  return paymentDate.toISODate();
                })
                .join(", ") +
              " will be transferred to the Savings."
            : null;
        }
      });
    }
  }

  public onSubmit(): void {
    this.viewState = "submitting";
    lastValueFrom(
      this.classesService.stopLearning(
        {
          classId: this.formGroup.value.classId,
          studentId: this.formGroup.value.studentId,
          reason: this.formGroup.value.reason,
          action: "confirmed",
          stoppedDate: DateTime.fromJSDate(this.formGroup.value.stoppedDate).toISODate(),
        },
        this.formGroup.value.studentClassId
      )
    )
      .then((res) => {
        this.nzNotificationService.create(res.success ? "success" : "error", "Stop Learning", res.message);
        if (res.success) {
          this.toggle();
          this.onSubmittedEmitter.emit();
        }
      })
      .finally(() => {
        this.viewState = "initial";
      });
  }
}

interface StopLearningI {
  debt: number;
  redundantSavings: number;
  offDays: IClassStudentRecord[];
  stoppedDate: string;
  proceedingDates: {
    previousPayments: IClassStudentRecord[];
    remainingPayments: IClassStudentRecord[];
  };
}
