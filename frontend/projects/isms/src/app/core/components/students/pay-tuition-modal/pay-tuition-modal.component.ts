import { DateTime, Interval } from "luxon";
import { AfterViewInit, Component, EventEmitter, OnDestroy, OnInit, Output, ViewChild, ViewEncapsulation } from "@angular/core";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { CommonModule, DatePipe, NgClass, NgFor, NgIf, NgTemplateOutlet } from "@angular/common";
import { SubSink } from "subsink";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { ClassesService, StudentsService } from "@isms-core/services";
import { IAccount, IClassPaymentHistory, IClassStudent } from "@isms-core/interfaces";
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
import { differenceInCalendarDays, differenceInDays, isAfter, isBefore } from "date-fns";
import { RRule } from "rrule";
import { isEmpty } from "lodash";
import { NzSpinModule } from "ng-zorro-antd/spin";
import { SavingsBreakdownModalComponent } from "../savings-breakdown-modal/savings-breakdown-modal.component";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { DraftTuitionModalComponent } from "../draft-tuition-modal/draft-tuition-modal.component";

@Component({
  selector: "isms-pay-tuition-modal",
  templateUrl: "./pay-tuition-modal.component.html",
  imports: [
    NgClass,
    NgIf,
    NgFor,
    DatePipe,
    FormsModule,
    CommonModule,
    ReactiveFormsModule,
    NzModalModule,
    NzIconModule,
    NzFormModule,
    NzButtonModule,
    NzInputNumberModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    NzToolTipModule,
    NzRadioModule,
    NzCheckboxModule,
    NzDatePickerModule,

    NzAlertModule,
    NzSpinModule,
    ProfilePhotoDirective,
    FormattedCurrencyPipe,
    SavingsBreakdownModalComponent,
    DraftTuitionModalComponent,
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
export class PayTuitionModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild("draftTuitionModal") draftTuitionModalComponent: DraftTuitionModalComponent;

  @Output("on-submitted") private readonly onSubmittedEmitter: EventEmitter<any> = new EventEmitter<any>();

  private readonly subSink: SubSink = new SubSink();
  public readonly formatterPercent = FormatterPercent;
  public readonly parserPercent = ParserPercent;
  public readonly formatterVND = FormatterVND;
  public readonly parserVND = ParserVND;
  public readonly formGroup = new FormGroup({
    lastDateOfClass: new FormControl("", [Validators.required]),
    cantPayThisMonth: new FormControl(false, [Validators.required]),
    // payDebtOfAMonth: new FormControl(false, [Validators.required]),
    studentId: new FormControl("", [Validators.required]),
    studentClassId: new FormControl("", [Validators.required]),
    classId: new FormControl("", [Validators.required]),
    classTypeOfRate: new FormControl(""),
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
    skipDebt: new FormControl(true),
    tuitionListingFilteredDate: new FormControl(DateTime.now().toJSDate()),
    stopLearningPayDebt: new FormControl(false),
  });
  public showModal: boolean = false;
  public dateInterval: Array<{ date: string; year: number; month: number; days: Array<{ remainingInMonth: boolean; enable: boolean; included: boolean; date: string }> }> = [];
  public classes: Array<any> = [];
  public students: Array<IAccount> = [];
  public pricing: IPricing = null;

  public setFromDate: boolean = false;
  public setToDate: boolean = false;
  public viewState: "initial" | "loading" | "submitting" = "initial";
  public student: IClassStudent | null = null;
  public disablePayButton: boolean = false;
  public payDebtOnly: boolean = false;
  public sameMonthAndHasDebt: boolean = false;

  constructor(
    private readonly classesService: ClassesService,
    private readonly studentsService: StudentsService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {
    // this.loadDateInterval();

    // this.subSink.add(
    //   this.formGroup.valueChanges.pipe(distinctUntilChanged(), debounceTime(100)).subscribe((value) => {
    //     this.loadPricing(true);
    //   })
    // );

    this.subSink.add(
      this.formGroup
        .get("studentId")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe(() => this.loadPricing(true)),
      this.formGroup
        .get("classId")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe(() => this.loadPricing(true)),
      this.formGroup
        .get("fromDate")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe(() => {
          this.setToDateBasedOnFromDate();
          this.setFromDate = true;
          // console.log("setFromDate");
          this.loadPricing(true);
        }),
      this.formGroup
        .get("toDate")
        .valueChanges.pipe(debounceTime(100))
        .subscribe(() => {
          this.setFromDate = true;
          this.setToDate = true;
          this.loadPricing(true);
        }),
      this.formGroup
        .get("includeNextMonthInPayment")
        .valueChanges.pipe(debounceTime(100))
        .subscribe((value: boolean) => {
          if (!value) {
            this.formGroup.get("skipDebt").setValue(false, { emitEvent: false });
          }
          this.loadPricing(true);
        }),
      this.formGroup
        .get("skipDebt")
        .valueChanges.pipe(debounceTime(100))
        .subscribe((value) => {
          this.setFromDate = true;
          this.setToDate = true;
          this.disablePayButton = value;
          this.loadPricing(true);
        })
      // this.formGroup
      //   .get("payDebtOfAMonth")
      //   .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
      //   .subscribe(() => this.loadPricing(true))
    );

    this.subSink.add(
      this.formGroup
        .get("paymentType")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe((value) => {
          this.setToDateBasedOnFromDate();

          if (value === "monthly") {
            this.formGroup.get("discount").setValue(0);
          }
          this.setFromDate = true;
          this.loadPricing(true);
        }),

      this.formGroup
        .get("discount")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(1000))
        .subscribe(() => this.loadPricing(false)),
      this.formGroup
        .get("addition")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(1000))
        .subscribe(() => this.loadPricing(false)),
      this.formGroup
        .get("subtraction")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(1000))
        .subscribe(() => this.loadPricing(false))
    );

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
      this.students = res.success ? res.data.items : [];
    });
  }

  ngAfterViewInit(): void {}

  public ngOnDestroy(): void {}

  private newlyToggled = false;
  public toggle(): void {
    this.newlyToggled = true;
    this.showModal = !this.showModal;
    if (this.showModal) {
      // this.loadDateInterval();
      this.loadPricing();
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
        classTypeOfRate: "",
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
        tuitionListingFilteredDate: DateTime.now().toJSDate(),
        skipDebt: false,
        stopLearningPayDebt: false,
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

  public setToDateBasedOnFromDate(): void {
    if (this.formGroup.value.paymentType === "monthly") {
      this.formGroup.get("toDate").setValue(DateTime.fromJSDate(this.formGroup.value.fromDate).endOf("month").toJSDate(), { emitEvent: false });
    }
  }

  public setFromDateAndToDate(): void {
    const fromDate = DateTime.fromJSDate(this.formGroup.value.tuitionListingFilteredDate);
    this.formGroup.get("fromDate").setValue(fromDate.toJSDate(), { emitEvent: false });
    const toDate = this.formGroup.value.paymentType === "monthly" ? fromDate.endOf("month") : fromDate.endOf("month").plus({ months: 1 });
    // if (this.formGroup.value.cantPayThisMonth) {
    this.formGroup.get("toDate").setValue(toDate.toJSDate(), { emitEvent: false }); //lastDateOfClass.plus({ months: 2 }).toJSDate());
    // }
  }

  public loadDateInterval(): void {
    const currentDate = DateTime.now();
    const scheduleFromDate = DateTime.fromISO(this.pricing.schedulesShift.startDate);

    let fromDate = DateTime.fromJSDate(this.formGroup.value.fromDate);

    const toDate = DateTime.fromJSDate(this.formGroup.value.toDate);

    // console.log("this.showAllDaysOfClass", this.showAllDaysOfClass);
    if (this.showAllDaysOfClass) {
      fromDate = DateTime.now().startOf("month");
    }

    // console.log("fromDate test", fromDate.toISO());

    const approximate = DataComposedRRule(fromDate, toDate, this.pricing).approximate.all();

    // console.log(
    //   "composedRRule total >> ",
    //   approximate.map((d) => DateTime.fromJSDate(d).toLocaleString(DateTime.DATE_FULL))
    // );

    this.dateInterval = [];

    let updatedApproximate = approximate;

    // console.log("updatedApproximate 1", updatedApproximate);

    /* filter associated date on that month  */
    const allPaidDaysOfSelectedMonth = approximate.filter((date, i) => {
      const luxonDate = DateTime.fromJSDate(date);
      const paidRecord = this.pricing.records.find((record) => {
        return record.day === luxonDate.day && record.month === luxonDate.month && record.year === luxonDate.year;
      });
      return paidRecord;
    });

    // remove the paid date
    if (allPaidDaysOfSelectedMonth.length > 0) {
      updatedApproximate = approximate.filter((date, i) => {
        const luxonDate = DateTime.fromJSDate(date);
        const notEqualRecord = this.pricing.records.find((record) => {
          return !record.paid && !record.enable && record.day === luxonDate.day && record.month === luxonDate.month && record.year === luxonDate.year;
          // return !record.paid && record.enable && record.day === luxonDate.day && record.month === luxonDate.month && record.year === luxonDate.year;
        });
        return notEqualRecord;
      });
    }

    // remove the unpaid off day
    // NOTE: issue is when off-day and unpaid, still showing in pay tuition
    // comment: working ang unpaid excluded days
    // uncomment: hindi working ang unpaid excluded days
    /* remove the off-days */
    // console.log("allPaidDaysOfSelectedMonth", allPaidDaysOfSelectedMonth);
    updatedApproximate = updatedApproximate.filter((date, i) => {
      const luxonDate = DateTime.fromJSDate(date);
      const notEqualRecord = this.pricing.records.find((record) => {
        return record.status !== "off-day" && record.day === luxonDate.day && record.month === luxonDate.month && record.year === luxonDate.year;
      });
      return notEqualRecord;
    });
    // console.log("updatedApproximate 2", updatedApproximate);

    // console.log("updatedApproximate 2.1", updatedApproximate);

    /* if month has a debt then show all the days of the month */
    let debtRecords = this.pricing.records.filter((r) => r.month === fromDate.month && r.year === fromDate.year && r.enable && !r.paid);

    if (debtRecords.length) {
      updatedApproximate = allPaidDaysOfSelectedMonth.filter((date) => {
        const luxonDate = DateTime.fromJSDate(date);
        const equalRecord = this.pricing.records.find((record) => {
          return record.day === luxonDate.day && record.month === luxonDate.month && record.year === luxonDate.year && !record.paid && record.status !== "off-day";
        });
        return equalRecord;
      });
    } else {
      /* has debt then disable pay button */
      // debtRecords = this.pricing.records.filter((r) => r.enable && !r.paid);
      // this.disablePayButton = debtRecords.length && !this.formGroup.value.payDebt;
    }
    // console.log("updatedApproximate 3", updatedApproximate);

    /* remove the behind date from the current date if showAllDaysOfClass is false */
    if (!this.showAllDaysOfClass) {
      updatedApproximate = updatedApproximate.filter((date, i) => {
        const luxonDate = DateTime.fromJSDate(date);
        return isAfter(luxonDate.toJSDate(), currentDate.toJSDate());
      });
    }

    updatedApproximate.forEach((date, i) => {
      const luxonDate = DateTime.fromJSDate(date);

      const isExistIndex = this.dateInterval.findIndex((d) => d.month === luxonDate.month && d.year === luxonDate.year);

      let enable = true;
      let included = true;
      let remainingInMonth = false;

      if (luxonDate.month === scheduleFromDate.month && luxonDate.year === scheduleFromDate.year) {
        included = differenceInDays(scheduleFromDate.toJSDate(), luxonDate.toJSDate()) <= 0;
        enable = included;
      }

      const selectedExcludedDateInRecord = this.pricing.records.find(
        (r) => r.day === luxonDate.day && r.month === luxonDate.month && r.year === luxonDate.year && ((!r.enable && r.included) || (r.enable && !r.paid))
      );

      if (selectedExcludedDateInRecord) {
        const luxonExcludedDateInRecord = DateTime.fromObject({
          day: selectedExcludedDateInRecord.day,
          month: selectedExcludedDateInRecord.month,
          year: selectedExcludedDateInRecord.year,
        });
        const fromDateEqualToFirstDateOfEnrolled =
          luxonDate.day === luxonExcludedDateInRecord.day && luxonDate.month === luxonExcludedDateInRecord.month && fromDate.year === luxonExcludedDateInRecord.year;
        if (fromDateEqualToFirstDateOfEnrolled) {
          included = true;
          enable = true;
        }
      }

      const excludePaidOrPushedInRecord = this.pricing.records.find(
        (r) => r.day === luxonDate.day && r.month === luxonDate.month && r.year === luxonDate.year && !r.enable && r.included
      );

      // console.log("fromDateEqualToFirstDateOfEnrolled", fromDateEqualToFirstDateOfEnrolled, fromDate.toISO());

      // console.log("isExistIndex", isExistIndex);
      if (isExistIndex === -1) {
        let days = [{ remainingInMonth: remainingInMonth, enable: enable, included: included, date: luxonDate.toISO() }];

        /* if the last enrolled month is empty */
        // if (equalToLastEnrolledMonth && !lastEnrolledDaysMonth) {
        //   days = [];
        // } else {
        this.dateInterval.push({ date: luxonDate.toISO(), year: luxonDate.year, month: luxonDate.month, days: days });
        // }
      } else {
        this.dateInterval[isExistIndex].days.push({ remainingInMonth: remainingInMonth, enable: enable, included: included, date: luxonDate.toISO() });
      }
    });

    // const intervalDate = Interval.fromDateTimes(fromDate.startOf("month"), toDate.endOf("month"))
    //   .splitBy({ day: 1 })
    //   .map((d: Interval) => d.start)
    //   .filter((d) => includeDaysInAWeek.includes(d.weekday));

    // console.log("intervalDate ", Interval.fromDateTimes(fromDate.startOf("month"), toDate.endOf("month")).splitBy({ day: 1 }), intervalDate);

    // this.dateInterval = [];

    // intervalDate.forEach((id) => {
    //   const isExistIndex = this.dateInterval.findIndex((d) => d.month === id.month && d.year === id.year);
    //   if (isExistIndex === -1) {
    //     this.dateInterval.push({ date: id, year: id.year, month: id.month, days: [{ enable: true, date: id }] });
    //   } else {
    //     this.dateInterval[isExistIndex].days.push({ enable: true, date: id });
    //   }
    // });

    /* exclude previous days of month */
    // this.dateInterval.map((di) => {
    //   if (di.month === new Date().getMonth() + 1 && di.year === new Date().getFullYear()) {
    //     di.days = di.days.filter((d) => d.date.day >= new Date().getDate());
    //   }
    //   return di;
    // });

    // console.log("dateInterval", this.dateInterval, this.formGroup.value.includeNextMonthInPayment);

    if (!this.formGroup.getRawValue().includeNextMonthInPayment) {
      this.dateInterval = [];
    }

    // console.log("dateInterval", JSON.stringify(this.dateInterval, null, 2));

    this.loadPricing(false);
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

  private loadPricing(loadDateInterval: boolean = true): void {
    const classData = this.classes.find((c) => c._id === this.formGroup.value.classId);
    if (classData) {
      this.formGroup.get("classTypeOfRate").setValue(classData.typeOfRate);
    }
    // console.log("loadPricing ", loadDateInterval);
    this.pricing = null;
    this.viewState = "loading";
    lastValueFrom(this.classesService.pricing(this.payload))
      .then((res) => {
        if (res.success) {
          this.pricing = res.data;

          if (this.formGroup.getRawValue().cantPayThisMonth) {
            this.formGroup.get("includeNextMonthInPayment").setValue(true, { emitEvent: false });
          }

          if (this.payDebtOnly) {
            /* if use selected date is not equal to tuition date */
            // setTimeout(() => {
            const tuitionListingFilteredDate = DateTime.fromJSDate(this.formGroup.getRawValue().fromDate);
            const isDateInDebtRecord = this.student.debtRecords.find((r) => r.month === tuitionListingFilteredDate.month && r.year === tuitionListingFilteredDate.year) || false;
            // console.log("isDateInDebtRecord", isDateInDebtRecord, this.student.debtRecords, tuitionListingFilteredDate.month, tuitionListingFilteredDate.year);
            this.disablePayButton = !isDateInDebtRecord;
            // }, 1000);
          }

          if (loadDateInterval) {
            this.loadDateInterval();
          }

          /* if modal is opened */
          // if (this.newlyToggled) {
          //   this.newlyToggled = false;
          //   this.loadDateInterval();
          // }
        }

        // this.loadDateInterval();

        // if (this.formGroup.value.cantPayThisMonth) {
        //   this.loadDateInterval();
        // }

        // if the user is in the same month that has a debt then hide debt and allow the student to pay
        const hasDebt = this.pricing.records.filter((record) => record.included && record.enable && !record.paid && record.status !== "off-day");
        // console.log("hasDebt ", hasDebt);
        if (this.pricing.totalAmountOfUnpaidDays > 0 && hasDebt.length > 0) {
          // console.log("has debt", this.pricing.totalAmountOfUnpaidDays);
          // this.formGroup.get("skipDebt").setValue(false, { emitEvent: false });
          // this.formGroup.get("skipDebt").disable({ emitEvent: false });
          this.sameMonthAndHasDebt = true;
        } else {
          this.sameMonthAndHasDebt = false;
          // this.formGroup.get("skipDebt").enable({ emitEvent: false });
        }
      })
      .finally(() => {
        this.viewState = "initial";
      });
  }

  public loadDraftTuition(value: any): void {
    console.log("loadDraftTuition", value);
    this.formGroup.patchValue(value);
    this.dateInterval = value.dateInterval;
    // console.log("res", res);
    // if (!res.success && this.showModal) {
    //   this.nzNotificationService.error("Enroll Student", res.message);
    // }
  }

  public excludeDate(intervalIndex: number, dayIndex: number): void {
    const enable = this.dateInterval.at(intervalIndex).days.at(dayIndex).enable;
    this.dateInterval.at(intervalIndex).days.at(dayIndex).enable = !enable;
    this.loadPricing(false);
  }

  public onSubmit(): void {
    this.viewState = "submitting";
    lastValueFrom(this.classesService.enroll(this.payload))
      .then((res) => {
        // this.nzNotificationService.create(res.success ? "success" : "error", "Pay Tuition", res.message);
        if (res.success) {
          this.toggle();
          this.defaultFormGroupValue();
          this.onSubmittedEmitter.emit(res.data);
        }
      })
      .finally(() => {
        this.viewState = "initial";
      });
  }

  public disabledPreviousDate = (current: Date): boolean => false;
  // public disabledPreviousDate = (current: Date): boolean => differenceInCalendarDays(current, DateTime.fromISO(this.formGroup.value.lastDateOfClass).plus({ month: 1 }).toJSDate()) < 0;
  // public disabledPreviousDate = (current: Date): boolean => differenceInCalendarDays(current, DateTime.now().minus.toJSDate()) < 0;

  private get payload(): any {
    const { paymentType } = this.formGroup.getRawValue();

    const days: {
      included: boolean;
      enable: boolean;
      remainingInMonth: boolean;
      day: number;
      month: number;
      year: number;
      paid: boolean;
      paymentType: string;
    }[] = [];
    this.dateInterval.forEach((interval) => {
      interval.days.forEach((day) => {
        let paid = false;
        if (!this.formGroup.value.cantPayThisMonth && day.enable) {
          paid = true;
        }
        if (this.formGroup.value.cantPayThisMonth) {
          paid = false;
        }

        // if the student want to exclude that day and student want to `move to debt` other days
        let included = day.included;
        let enable = day.enable;
        const cantPayThisMonth = this.formGroup.value.cantPayThisMonth;
        if (cantPayThisMonth && !enable) {
          included = false;
          enable = false;
        }

        days.push({
          included: included,
          enable: enable,
          remainingInMonth: day.remainingInMonth,
          day: DateTime.fromISO(day.date).day,
          month: DateTime.fromISO(day.date).month,
          year: DateTime.fromISO(day.date).year,
          paid: paid,
          paymentType: day.enable ? paymentType : null, // if the user disable the day it should not have a payment type
        });
      });
    });

    const { discount, skipDebt } = this.formGroup.getRawValue();
    return {
      studentClassId: this.formGroup.value.studentClassId,
      classId: this.formGroup.value.classId,
      studentId: this.formGroup.value.studentId,
      dates: days,
      cantPayThisMonth: this.formGroup.value.cantPayThisMonth,
      discount: discount,
      addition: typeof this.formGroup.value.addition === "string" ? parseInt(this.formGroup.value.addition) : this.formGroup.value.addition,
      subtraction: typeof this.formGroup.value.subtraction === "string" ? parseInt(this.formGroup.value.subtraction) : this.formGroup.value.subtraction,
      notes: this.formGroup.value.notes,
      payDebt: !skipDebt, // do this because it empty the days when paying the tuition
    };
  }

  public resetForm(): void {
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
    this.disablePayButton = false;
    this.payDebtOnly = false;
  }

  public showAllDaysOfClass: boolean = false;
  public toggleShowAllDaysOfClass(): void {
    // this.showAllDaysOfClass = !this.showAllDaysOfClass;
    // console.error("res", this.showAllDaysOfClass);
    this.loadDateInterval(); // refresh the dates
  }

  public enableDisable(enable: boolean): void {
    if (enable) {
      this.formGroup.get("paymentType").enable();
      this.formGroup.get("discount").enable();

      this.formGroup.get("skipDebt").enable({ emitEvent: false });

      this.formGroup.get("fromDate").enable();
      this.formGroup.get("toDate").enable();
    } else {
      this.formGroup.get("paymentType").disable();
      this.formGroup.get("discount").disable();

      this.formGroup.get("skipDebt").disable();

      this.formGroup.get("fromDate").disable();
      this.formGroup.get("toDate").disable();
    }
  }
}
