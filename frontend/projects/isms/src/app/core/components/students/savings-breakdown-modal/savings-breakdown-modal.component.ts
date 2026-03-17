import { Component, Input, OnDestroy, OnInit, TemplateRef, ViewChild } from "@angular/core";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NgFor, NgIf } from "@angular/common";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { NzNotificationComponent, NzNotificationService } from "ng-zorro-antd/notification";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { FormattedCurrencyPipe } from "@isms-core/pipes";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzFormModule } from "ng-zorro-antd/form";
import { NzSpinModule } from "ng-zorro-antd/spin";
import { lastValueFrom } from "rxjs";
import { ClassesService } from "@isms-core/services";
import { IClassStudentRecord, ICourse } from "@isms-core/interfaces";
import { DateTime } from "luxon";
import { IPricing } from "../enroll-new-student-modal/enroll-new-student-modal.component";
import { NzEmptyModule } from "ng-zorro-antd/empty";

@Component({
  selector: "isms-savings-breakdown-modal",
  templateUrl: "./savings-breakdown-modal.component.html",
  imports: [
    NgIf,
    NgFor,
    FormsModule,
    ReactiveFormsModule,
    NzModalModule,
    NzIconModule,
    NzFormModule,
    NzButtonModule,
    NzInputNumberModule,
    NzInputModule,
    NzSelectModule,
    NzToolTipModule,
    NzRadioModule,
    NzCheckboxModule,
    NzDatePickerModule,

    NzAlertModule,
    NzSpinModule,
    NzEmptyModule,
    FormattedCurrencyPipe,
  ],
})
export class SavingsBreakdownModalComponent implements OnInit, OnDestroy {
  @Input("student-id") studentId: string;
  @Input("refund") refund: boolean = false;
  @Input("in-pay-tuition") inPayTuition: boolean = false;
  @Input("pricing") pricing: IPricing;

  public showSavingsBreakdownModal: boolean = false;
  public showRefundModal: boolean = false;

  public savings: any = null;
  public offDays: SavingsBreakdown[] = [];
  public stopLearnings: SavingsBreakdown[] = [];

  public refundViewState: "initial" | "processing-refund" = "initial";
  public refundFormGroup: FormGroup = new FormGroup({
    amount: new FormControl(0, [Validators.required]),
  });

  constructor(
    private readonly notificationService: NzNotificationService,
    private readonly classesService: ClassesService
  ) {}

  public ngOnInit(): void {
    this.loadSavings();
  }

  public ngOnDestroy(): void {}

  public loadSavingsBreakdown(): void {
    lastValueFrom(this.classesService.savingsBreakdown(this.studentId)).then((res) => {
      this.offDays = [];
      this.stopLearnings = [];
      if (res.success) {
        const savingsBreakdowns = (res.data as SavingsBreakdown[]).map((r) => {
          const dateInterval: SavingsDateI[] = [];

          r.records.forEach((record) => {
            const luxonDate = DateTime.fromObject({
              day: record.day,
              month: record.month,
              year: record.year,
            });

            const isExistIndex = dateInterval.findIndex((d) => d.month === record.month && d.year === record.year);

            let enable = true;
            let included = true;
            let remainingInMonth = false;

            // console.log("fromDateEqualToFirstDateOfEnrolled", fromDateEqualToFirstDateOfEnrolled, fromDate.toISO());

            console.log("isExistIndex", isExistIndex);
            if (isExistIndex === -1) {
              // let days = [{ remainingInMonth: remainingInMonth, enable: enable, included: included, date: luxonDate }];

              /* if the last enrolled month is empty */
              // if (equalToLastEnrolledMonth && !lastEnrolledDaysMonth) {
              //   days = [];
              // } else {
              dateInterval.push({ date: luxonDate, year: luxonDate.year, month: luxonDate.month, records: [record] });
              // }
            } else {
              dateInterval[isExistIndex].records.push(record);
            }
          });

          r["dates"] = dateInterval;

          return r;
        });
        this.offDays = res.success ? savingsBreakdowns.filter((r: SavingsBreakdown) => r.type === "off-day") : [];
        this.stopLearnings = res.success ? savingsBreakdowns.filter((r: SavingsBreakdown) => r.type === "stop-learning") : [];
      }
    });
  }

  public loadSavings(): void {
    lastValueFrom(this.classesService.savings(this.studentId)).then((res) => {
      this.savings = res.success ? res.data : null;
    });
  }

  public toggleSavingsBreakdownModal(): void {
    this.showSavingsBreakdownModal = !this.showSavingsBreakdownModal;
    if (this.showSavingsBreakdownModal) {
      this.loadSavingsBreakdown();
    }
  }

  public toggleRefundModal(): void {
    this.refundFormGroup.reset();
    this.showRefundModal = !this.showRefundModal;
  }

  public onSubmitRefund(): void {
    this.refundFormGroup.markAllAsTouched();

    this.refundViewState = "processing-refund";

    lastValueFrom(
      this.classesService.refund({
        studentId: this.studentId,
        amount: this.refundFormGroup.value.amount,
      })
    )
      .then((res) => {
        this.showRefundModal = false;
        this.loadSavings();
        if (res.success) {
          this.notificationService.template(this.tuitionRefundReceiptTemplate! as any, {
            nzPlacement: "bottomRight",
            nzData: {
              transactionId: res.data.transactionId,
            },
          });
        }
      })
      .finally(() => {
        this.refundViewState = "initial";
      });
  }

  @ViewChild("tuitionRefundReceiptTemplate", { static: true }) tuitionRefundReceiptTemplate!: TemplateRef<{ $implicit: NzNotificationComponent }>;
}

interface SavingsBreakdown {
  _id: string;
  amount: number;
  amountDeducted: number;
  records: IClassStudentRecord[];
  student: string;
  studentsTuitionAttendance: string;
  classes: { name: string };
  courses: ICourse;
  status: "ongoing" | "completed";
  type: "off-day" | "stop-learning";
  properties: string;
  propertiesBranches: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;

  // addded in FE
  dates?: SavingsDateI[];
}

interface SavingsDateI {
  date: DateTime;
  year: number;
  month: number;
  records: Array<IClassStudentRecord>;
}
