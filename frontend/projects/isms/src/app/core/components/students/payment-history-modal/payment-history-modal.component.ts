import { DateTime, Interval } from "luxon";
import { Component, EventEmitter, OnDestroy, OnInit, Output, ViewEncapsulation } from "@angular/core";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { DatePipe, NgClass, NgFor, NgIf } from "@angular/common";
import { SubSink } from "subsink";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { ClassesService, StudentsService } from "@isms-core/services";
import { IAccount, IClassPaymentHistory, IClassStudent, IClassStudentRecord } from "@isms-core/interfaces";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { ComposedRRule, FormatterVND, FormatterPercent, ParserVND, ParserPercent, DataComposedRRule } from "@isms-core/utils";
import { FormattedCurrencyPipe } from "@isms-core/pipes";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzFormModule } from "ng-zorro-antd/form";
import { IPricing } from "../enroll-new-student-modal/enroll-new-student-modal.component";
import { differenceInCalendarDays, differenceInDays } from "date-fns";
import { RRule } from "rrule";
import { isEmpty } from "lodash";
import { NzSpinModule } from "ng-zorro-antd/spin";

@Component({
  selector: "isms-payment-history-modal",
  templateUrl: "./payment-history-modal.component.html",
  imports: [
    NgClass,
    NgIf,
    NgFor,
    DatePipe,
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
    ProfilePhotoDirective,
    FormattedCurrencyPipe,
  ],
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      .ant-spin-container {
        @apply flex-1;
      }
    `,
  ],
})
export class PaymentHistoryModalComponent implements OnInit, OnDestroy {
  private readonly subSink: SubSink = new SubSink();
  public readonly formatterPercent = FormatterPercent;
  public readonly parserPercent = ParserPercent;
  public readonly formatterVND = FormatterVND;
  public readonly parserVND = ParserVND;
  public readonly formGroup = new FormGroup({
    lastDateOfClass: new FormControl("", [Validators.required]),
    cantPayThisMonth: new FormControl(false, [Validators.required]),
    studentId: new FormControl("", [Validators.required]),
    studentClassId: new FormControl("", [Validators.required]),
    classId: new FormControl("", [Validators.required]),
    paymentType: new FormControl("monthly", [Validators.required]),
    discount: new FormControl(0, []),
    addition: new FormControl(0, []),
    subtraction: new FormControl(0, []),
    notes: new FormControl(null, []),
    modeOfPayment: new FormControl("cash", [Validators.required]),
    includeNextMonthInPayment: new FormControl(false, [Validators.required]),
    fromDate: new FormControl(DateTime.now().toJSDate(), [Validators.required]),
    toDate: new FormControl(DateTime.now().plus({ month: 1 }).toJSDate(), [Validators.required]),
    hasOffDay: new FormControl(false),
  });

  public student: IClassStudent = null;
  public paymentHistory: IClassPaymentHistory = null;

  public showModal: boolean = false;
  public dateInterval: Array<{ date: DateTime; year: number; month: number; records: Array<IClassStudentRecord> }> = [];
  public classes: Array<any> = [];
  public students: Array<IAccount> = [];
  // public pricing: IPricing = null;

  public setFromDate: boolean = false;
  public setToDate: boolean = false;
  public viewState: "initial" | "loading" = "initial";

  constructor(
    private readonly classesService: ClassesService,
    private readonly studentsService: StudentsService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {
    lastValueFrom(this.classesService.fetch()).then((res) => {
      this.classes = res.success ? res.data : [];
    });

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
  }

  public ngOnDestroy(): void {}

  private newlyToggled = false;
  public toggle(): void {
    this.newlyToggled = true;
    this.resetForm();
    this.showModal = !this.showModal;
    if (this.showModal) {
      this.loadDateInterval();
    }
  }

  public defaultFormGroupValue(): void {
    this.formGroup.setValue(
      {
        lastDateOfClass: null,
        cantPayThisMonth: false,
        studentId: "",
        studentClassId: "",
        classId: "",
        paymentType: "monthly",
        modeOfPayment: "cash",
        discount: 0,
        addition: 0,
        subtraction: 0,
        notes: null,
        includeNextMonthInPayment: false,
        fromDate: DateTime.now().toJSDate(),
        toDate: DateTime.now().plus({ month: 1 }).toJSDate(),
        hasOffDay: false,
      },
      { emitEvent: false }
    );

    this.setFromDate = false;
    this.setToDate = false;
  }

  // private setFromToDateFormGroup(loadDateInterval: boolean): void {
  //   const currentDate = DateTime.now();
  //   const scheduleFromDate = DateTime.fromISO(this.pricing.schedulesShift.startDate as any as string);

  //   /* if differenceInDays is less than 0 then get the current date */
  //   const fromDate = differenceInDays(scheduleFromDate.toJSDate(), currentDate.toJSDate()) > 0 ? scheduleFromDate : currentDate;

  //   if (this.setFromDate) {
  //     this.formGroup.get("fromDate").setValue(fromDate.toJSDate(), { emitEvent: false });
  //   }

  //   // if (this.setFromDate) {
  //   //   this.formGroup.get("fromDate").setValue(composedRRule.approximate.all()[0], { emitEvent: false });
  //   // }

  //   const toDate = this.formGroup.value.paymentType === "monthly" ? DateTime.fromJSDate(this.formGroup.value.fromDate).endOf("month") : DateTime.fromJSDate(this.formGroup.value.toDate).endOf("month");

  //   console.log(
  //     "setFromToDateFormGroup >>> ",
  //     fromDate.toISO(),
  //     toDate.toISO(),
  //     this.setToDate,
  //     differenceInDays(DateTime.fromJSDate(this.formGroup.value.fromDate).toJSDate(), DateTime.fromJSDate(this.formGroup.value.toDate).toJSDate())
  //   );

  //   if (this.setToDate || differenceInDays(DateTime.fromJSDate(this.formGroup.value.fromDate).toJSDate(), DateTime.fromJSDate(this.formGroup.value.toDate).toJSDate()) < 0) {
  //     this.formGroup.get("toDate").setValue(toDate.toJSDate(), { emitEvent: false });
  //     console.log("sett here", toDate.toISO(), this.formGroup.get("toDate").value);
  //   }

  //   if (loadDateInterval) {
  //     this.loadDateInterval();
  //   }

  //   this.setFromDate = false;
  //   this.setToDate = false;
  // }

  public loadDateInterval(): void {
    /* set the from date based on the lastDateEnrolled  */
    let fromDate = DateTime.fromISO(this.paymentHistory.data.fromDate);
    let toDate = DateTime.fromISO(this.paymentHistory.data.toDate);

    // const approximate = DataComposedRRule(fromDate, toDate, this.paymentHistory.data).approximate.all();

    // console.log(
    //   "composedRRule total >> ",
    //   approximate.map((d) => DateTime.fromJSDate(d).toLocaleString(DateTime.DATE_FULL))
    // );

    this.dateInterval = [];

    this.paymentHistory.data.dates.forEach((record, i) => {
      if (record.enable && record.included && record.paid) {
        const luxonDate = DateTime.fromObject({
          day: record.day,
          month: record.month,
          year: record.year,
        });

        const isExistIndex = this.dateInterval.findIndex((d) => d.month === record.month && d.year === record.year);

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
          this.dateInterval.push({ date: luxonDate, year: luxonDate.year, month: luxonDate.month, records: [record] });
          // }
        } else {
          this.dateInterval[isExistIndex].records.push(record);
        }
      }
    });
  }

  // private composedRRule(fromDate: DateTime, toDate: DateTime): { approximate: RRule; nonApproximate: RRule } {
  //   const composeRRule = ComposedRRule({
  //     ...this.pricing.schedulesShift.schedule,
  //     fromDate: fromDate.toJSDate(), //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromDate as any).toJSDate(),
  //     fromTime: fromDate.startOf("day").toJSDate(), //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromTime as any).toJSDate(),
  //     toDate: toDate.toJSDate(),
  //     toTime: toDate.endOf("day").toJSDate() // DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.toTime as any).toJSDate()
  //   });

  //   if (composeRRule.approximate.all().length === 0) {
  //     let _fromDate = fromDate.plus({ days: 1 });
  //     let _toDate = toDate;
  //     if (_fromDate.day === _toDate.day && _fromDate.month === _toDate.month && _fromDate.year === _toDate.year) {
  //       _toDate = _toDate.plus({ months: 1 });
  //       // console.log("extend here", _fromDate.toISO(), _toDate.toISO());
  //     }

  //     // console.log("a >>> ", _fromDate.day, _toDate.day, _fromDate.month, _toDate.month, _fromDate.year, _toDate.year, ">>", composeRRule.approximate.all().length, fromDate.toISO(), toDate.toISO());

  //     return this.composedRRule(_fromDate, _toDate);
  //   }
  //   return composeRRule;
  // }

  public disabledPreviousDate = (current: Date): boolean => false;
  // public disabledPreviousDate = (current: Date): boolean => differenceInCalendarDays(current, DateTime.fromISO(this.formGroup.value.lastDateOfClass).plus({ month: 1 }).toJSDate()) < 0;
  // public disabledPreviousDate = (current: Date): boolean => differenceInCalendarDays(current, DateTime.now().minus.toJSDate()) < 0;

  private resetForm(): void {
    this.formGroup.get("paymentType").reset("monthly", { emitEvent: false });
    this.formGroup.get("modeOfPayment").reset("cash", { emitEvent: false });

    // this.formGroup.get("fromDate").setValue(DateTime.now().toJSDate(), { emitEvent: false });
    // this.formGroup.get("toDate").setValue(DateTime.now().plus({ month: 1 }).toJSDate(), { emitEvent: false });

    this.formGroup.get("discount").reset(0, { emitEvent: false });
    this.formGroup.get("addition").reset(0, { emitEvent: false });
    this.formGroup.get("subtraction").reset(0, { emitEvent: false });
    this.formGroup.get("notes").reset(null, { emitEvent: false });

    this.setFromDate = false;
    this.setToDate = false;
  }
}
