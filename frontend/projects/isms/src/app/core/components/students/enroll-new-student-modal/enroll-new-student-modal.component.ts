import { DateTime } from "luxon";
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
import { differenceInCalendarDays, differenceInDays, differenceInMonths, differenceInCalendarMonths, isAfter, isEqual } from "date-fns";
import { ClassesService, StudentsService } from "@isms-core/services";
import { IAccount, IClassStudentRecord, IScheduleSchedulesShift } from "@isms-core/interfaces";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { FormatterPercent, ParserPercent, ParserVND, FormatterVND, ComposedRRule, DataComposedRRule } from "@isms-core/utils";
import { FormattedCurrencyPipe } from "@isms-core/pipes";
import { NzFormModule } from "ng-zorro-antd/form";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzSpinModule } from "ng-zorro-antd/spin";
import { RRule } from "rrule";
import { SavingsBreakdownModalComponent } from "../savings-breakdown-modal/savings-breakdown-modal.component";
import { last } from "lodash";
import { NzSwitchModule } from "ng-zorro-antd/switch";

@Component({
  selector: "isms-enroll-new-student-modal",
  templateUrl: "./enroll-new-student-modal.component.html",
  imports: [
    NgClass,
    NgIf,
    NgFor,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzModalModule,
    NzIconModule,
    NzButtonModule,
    NzInputNumberModule,
    NzInputModule,
    NzFormModule,
    NzSelectModule,
    NzToolTipModule,
    NzRadioModule,
    NzDatePickerModule,

    NzAlertModule,
    NzSpinModule,
    NzSwitchModule,
    ProfilePhotoDirective,
    FormattedCurrencyPipe,
    SavingsBreakdownModalComponent,
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
export class EnrollNewStudentModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") private readonly onSubmittedEmitter: EventEmitter<any> = new EventEmitter<any>();

  private subSink: SubSink = new SubSink();
  public formatterPercent = FormatterPercent;
  public parserPercent = ParserPercent;
  public formatterVND = FormatterVND;
  public parserVND = ParserVND;
  public formGroup = new FormGroup({
    studentId: new FormControl("", [Validators.required]),
    classId: new FormControl("", [Validators.required]),
    classTypeOfRate: new FormControl(""),
    paymentType: new FormControl("monthly", [Validators.required]),
    modeOfPayment: new FormControl("cash", [Validators.required]),
    fromDate: new FormControl(null, [Validators.required]), //DateTime.now().toJSDate()
    toDate: new FormControl(null, [Validators.required]), //DateTime.now().plus({ month: 1 }).toJSDate()
    discount: new FormControl(0, []),
    addition: new FormControl(0, []),
    subtraction: new FormControl(0, []),
    notes: new FormControl(null, []),
    tuitionListingFilteredDate: new FormControl(DateTime.now().toJSDate()),
  });
  public showModal: boolean = false;
  public dateInterval: Array<{ date: DateTime; year: number; month: number; days: Array<{ included: boolean; enable: boolean; date: DateTime }> }> = [];
  public classes: Array<any> = [];
  public students: Array<IAccount> = [];
  public pricing: IPricing = null;

  public setFromDate: boolean = false;
  public setToDate: boolean = false;
  public viewState: "initial" | "submitting" | "loading" = "initial";

  constructor(
    private readonly classesService: ClassesService,
    private readonly studentsService: StudentsService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {
    // this.loadDateInterval();
    // this.loadPricing();

    this.subSink.add(
      this.formGroup
        .get("paymentType")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe((value) => {
          if (value === "monthly") {
            this.formGroup.get("discount").setValue(0);
          }
        })
    );

    // this.subSink.add(
    //   this.formGroup.valueChanges.pipe(distinctUntilChanged(), debounceTime(100)).subscribe((value) => {
    //     this.loadPricing(true);
    //   })
    // );

    this.subSink.add(
      this.formGroup
        .get("studentId")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe(() => {
          this.checkIfStudentHasDebts();
          // this.setFromToDate = false;
          this.loadPricing(true);
        }),
      this.formGroup
        .get("classId")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe(() => {
          this.setFromDate = true;
          this.setToDate = true;
          this.loadPricing(true);
        }),
      this.formGroup
        .get("paymentType")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe(() => {
          // this.setFromToDate = false;
          this.loadPricing(true);
        }),
      this.formGroup
        .get("fromDate")
        .valueChanges.pipe(debounceTime(100))
        .subscribe(() => {
          this.setToDateBasedOnFromDate();
          this.setToDate = true;
          this.loadPricing(true);
        }),
      this.formGroup
        .get("toDate")
        .valueChanges.pipe(debounceTime(100))
        .subscribe(() => {
          this.loadPricing(true);
        })
    );

    this.subSink.add(
      this.formGroup
        .get("paymentType")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe(() => {
          this.setToDateBasedOnFromDate();
        }),
      this.formGroup
        .get("discount")
        .valueChanges.pipe(debounceTime(1000))
        .subscribe(() => this.loadPricing(false)),
      this.formGroup
        .get("addition")
        .valueChanges.pipe(debounceTime(1000))
        .subscribe(() => this.loadPricing(false)),
      this.formGroup
        .get("subtraction")
        .valueChanges.pipe(debounceTime(1000))
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

  public ngOnDestroy(): void {}

  public toggle(): void {
    this.resetForm();
    this.showModal = !this.showModal;
    // if (this.showModal) {
    //   this.defaultFormValue();
    // }
  }

  public defaultFormValue(): void {
    this.formGroup.setValue({
      studentId: "",
      classId: "",
      classTypeOfRate: "",
      paymentType: "monthly",
      modeOfPayment: "cash",
      discount: 0,
      addition: 0,
      subtraction: 0,
      notes: null,
      fromDate: null, //DateTime.now().toJSDate(),
      toDate: null, // DateTime.now().plus({ month: 1 }).toJSDate()
      tuitionListingFilteredDate: DateTime.now().toJSDate(),
    });
  }

  public onChangeFromDate(date: Date): void {
    console.error("onChangeFromDate ", DateTime.fromJSDate(date).toISO());
  }

  // private setFromToDateFormGroup(loadDateInterval: boolean): void {
  //   const currentDate = DateTime.now();
  //   const scheduleFromDate = DateTime.fromISO(this.pricing.schedulesShift.startDate as any as string);

  //   console.log("diff ", differenceInDays(scheduleFromDate.toJSDate(), currentDate.toJSDate()));

  //   /* if differenceInDays is less than 0 then get the current date */
  //   let fromDate = differenceInDays(scheduleFromDate.toJSDate(), currentDate.toJSDate()) > 0 ? scheduleFromDate : currentDate;

  //   /* if scheduleFromDate is behind the currentDate */
  //   if (currentDate.month === scheduleFromDate.month && currentDate.year === scheduleFromDate.year) {
  //     fromDate = currentDate.startOf("month"); //differenceInDays(scheduleFromDate.toJSDate(), currentDate.toJSDate()) > 0 ? scheduleFromDate : currentDate;
  //   }

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

  public setFromDateAndToDate(): void {
    const fromDate = DateTime.fromJSDate(this.formGroup.value.tuitionListingFilteredDate);
    this.formGroup.get("fromDate").setValue(fromDate.toJSDate(), { emitEvent: false });
    const toDate = this.formGroup.value.paymentType === "monthly" ? fromDate.endOf("month") : fromDate.endOf("month").plus({ months: 1 });
    // if (this.formGroup.value.cantPayThisMonth) {
    this.formGroup.get("toDate").setValue(toDate.toJSDate(), { emitEvent: false }); //lastDateOfClass.plus({ months: 2 }).toJSDate());
    // }
  }

  public endRecurringDate: Date = null;

  public disabledFromToDatePicker = (current: Date): boolean => (this.endRecurringDate ? differenceInCalendarMonths(current, this.endRecurringDate) > 0 : false);

  private loadDateInterval(): void {
    const currentDate = DateTime.now();
    // const scheduleFromDate = DateTime.fromISO(this.pricing.schedulesShift.startDate as any as string).startOf("month");

    // let fromDate = scheduleFromDate >= currentDate ? scheduleFromDate : currentDate;

    // if (!currentDate.hasSame(fromDate, "month")) {
    //   fromDate = DateTime.fromJSDate(this.formGroup.value.fromDate).startOf("month");
    // }

    // const fromDate = currentDate.startOf("month"); //

    let fromDate = DateTime.fromJSDate(this.formGroup.value.fromDate).startOf("month");
    if (this.pricing.records.length === 0) {
      fromDate = fromDate.startOf("month");
    }

    let toDate = DateTime.fromJSDate(this.formGroup.value.toDate).endOf("month"); //this.formGroup.value.paymentType === "monthly" ? DateTime.fromJSDate(this.formGroup.value.fromDate).endOf("month") : DateTime.fromJSDate(this.formGroup.value.toDate).endOf("month");
    // console.log("toDate 1", fromDate.toISO(), toDate.toISO());

    /* scheduleEndDate */
    const scheduleEndDate = ComposedRRule(
      {
        ...this.pricing.schedulesShift.schedule,
        allDay: false,
        fromDate: DateTime.fromISO(this.pricing.schedulesShift.startDate).toJSDate(),
        fromTime: DateTime.fromISO(this.pricing.schedulesShift.startDate).startOf("day").toJSDate(),
        toDate: null,
      },
      true
    );
    // console.log("last", last(scheduleEndDate.approximate.all()));

    /* if the schedule date has a recurring end on/after */
    this.endRecurringDate = scheduleEndDate.approximate.all().length > 0 ? last(scheduleEndDate.approximate.all()) : null;
    if (this.endRecurringDate && this.formGroup.value.paymentType === "package") {
      const endRecurringLuxonDate = DateTime.fromJSDate(this.endRecurringDate).set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
      const date1 = DateTime.fromJSDate(this.formGroup.value.toDate).set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
      const date2 = endRecurringLuxonDate;
      if (date1 >= date2) {
        toDate = DateTime.fromJSDate(this.endRecurringDate);
      }
    }

    // console.log("toDate 2", fromDate.toISO(), toDate.toISO());

    // const includeDaysInAWeek: number[] = [0, 1, 2, 3, 4, 5, 6]; // equivalent of Sunday to Saturday

    // console.log("pricing => ", this.pricing);

    // console.log("schedule => ", this.pricing.schedulesShift.schedules.schedule);

    // console.log("timee => ", {
    //   fromDate: fromDate, //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromDate as any).toJSDate(),
    //   fromTime: fromDate, //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromTime as any).toJSDate(),
    //   toDate: fromDate.endOf("month").toJSDate(),
    //   toTime: fromDate.endOf("month").toJSDate() //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.toTime as any).toJSDate()
    // });

    // const composedRRule = ComposedRRule({
    //   ...this.pricing.schedulesShift.schedule,
    //   fromDate: fromDate.toJSDate(), //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromDate as any).toJSDate(),
    //   fromTime: fromDate.startOf("day").toJSDate(), //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromTime as any).toJSDate(),
    //   toDate: toDate.toJSDate(),
    //   toTime: toDate.endOf("day").toJSDate() // DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.toTime as any).toJSDate()
    // });

    /* if schedule startDate is greater than fromDate then follow the start date */
    const scheduleStartDate = DateTime.fromISO(this.pricing.schedulesShift.startDate);
    const diffOfFromDateAndScheduleStartDate: number = differenceInDays(scheduleStartDate.toJSDate(), fromDate.toJSDate());

    // console.log("diffOfFromDateAndScheduleStartDate ", diffOfFromDateAndScheduleStartDate);

    if (diffOfFromDateAndScheduleStartDate > 0) {
      fromDate = scheduleStartDate;
    } else {
      const diffOfCurrentDateAndScheduleStartDate: number = differenceInDays(currentDate.toJSDate(), fromDate.toJSDate());
      // console.log("diffOfCurrentDateAndScheduleStartDate", diffOfCurrentDateAndScheduleStartDate);
      if (diffOfCurrentDateAndScheduleStartDate > 0) {
        // this.formGroup.get("fromDate").setValue(currentDate.toJSDate(), { emitEvent: false });
        // this.formGroup.get("toDate").setValue(currentDate.endOf("month"), { emitEvent: false });
        fromDate = currentDate;
      }
    }
    // console.log("bgm ", fromDate.toISO(), toDate.toISO(), diffOfFromDateAndScheduleStartDate);

    // console.log("this.showAllDaysOfClass", this.showAllDaysOfClass);
    if (this.showAllDaysOfClass) {
      // fromDate = DateTime.now().startOf("month");
      fromDate = DateTime.fromJSDate(this.formGroup.value.fromDate).startOf("month");
    }

    console.log("fromDate", fromDate.toISO());

    const approximate = DataComposedRRule(fromDate, toDate, this.pricing).approximate.all();

    // this.formGroup.get("fromDate").setValue(composedRRule.approximate.all()[0], { emitEvent: false });

    // console.log("composedRRule total >> ", approximate);

    // console.log("composedRRule ", composedRRule);

    this.dateInterval = [];

    approximate.forEach((date, i) => {
      // this.scheduleItems.push({
      //   id: i,
      //   sectionID: sectionId,
      //   name: null, //"shift.title",
      //   start: moment(date).startOf("day"),
      //   end: moment(date).endOf("day"),
      //   classes: ""
      // });
      // console.log("date => ", date);

      const luxonDate = DateTime.fromJSDate(date);

      const isExistIndex = this.dateInterval.findIndex((d) => d.month === luxonDate.month && d.year === luxonDate.year);

      let enable = true;
      let included = true;

      if (luxonDate.month === currentDate.month && luxonDate.year === currentDate.year) {
        included = true; //differenceInDays(currentDate.toJSDate(), luxonDate.toJSDate()) <= 0;
        enable = included;
        // console.log("luxonDate", luxonDate.toISODate(), included);
      }

      if (isExistIndex === -1) {
        this.dateInterval.push({ date: luxonDate, year: luxonDate.year, month: luxonDate.month, days: [{ included: included, enable: enable, date: luxonDate }] });
      } else {
        this.dateInterval[isExistIndex].days.push({ included: included, enable: enable, date: luxonDate });
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

    console.log("dateInterval", fromDate.toISO(), toDate.toISO(), JSON.stringify(this.dateInterval, null, 2));
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
  //     }
  //     return this.composedRRule(_fromDate, _toDate);
  //   }
  //   return composeRRule;
  // }

  // private loadDateInterval(): void {
  //   const currentDate = DateTime.now();
  //   const scheduleFromDate = DateTime.fromISO(this.pricing.schedulesShift.startDate as any as string);

  //   /* if differenceInDays is less than 0 then get the current date */
  //   let fromDate = differenceInDays(scheduleFromDate.toJSDate(), currentDate.toJSDate()) > 0 ? scheduleFromDate : currentDate;

  //   console.log(
  //     "fromDate 1: ",
  //     fromDate.toISO(),
  //     currentDate.toISO(),
  //     scheduleFromDate.toISO(),
  //     isBefore(scheduleFromDate.toJSDate(), currentDate.toJSDate()),
  //     isEqual(scheduleFromDate.toJSDate(), currentDate.toJSDate()),
  //     differenceInDays(scheduleFromDate.toJSDate(), currentDate.toJSDate())
  //   );

  //   // if (!currentDate.hasSame(fromDate, "month")) {
  //   //   fromDate = DateTime.fromJSDate(this.formGroup.value.fromDate).startOf("month");
  //   // }

  //   const toDate = this.formGroup.value.paymentType === "monthly" ? fromDate.endOf("month") : fromDate.endOf("month").plus({ month: 1 }).endOf("month");

  //   console.log("fromDate: ", fromDate.toISO(), "toDate: ", toDate.toISO(), this.setFromDate);

  //   // const includeDaysInAWeek: number[] = [0, 1, 2, 3, 4, 5, 6]; // equivalent of Sunday to Saturday

  //   // console.log("pricing => ", this.pricing);

  //   // console.log("schedule => ", this.pricing.schedulesShift.schedules.schedule);

  //   // console.log("timee => ", {
  //   //   fromDate: fromDate, //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromDate as any).toJSDate(),
  //   //   fromTime: fromDate, //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromTime as any).toJSDate(),
  //   //   toDate: fromDate.endOf("month").toJSDate(),
  //   //   toTime: fromDate.endOf("month").toJSDate() //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.toTime as any).toJSDate()
  //   // });

  //   const composedRRule = ComposedRRule({
  //     ...this.pricing.schedulesShift.schedules.schedule,
  //     fromDate: fromDate.toJSDate(), //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromDate as any).toJSDate(),
  //     fromTime: fromDate.startOf("day").toJSDate(), //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromTime as any).toJSDate(),
  //     toDate: toDate.toJSDate(),
  //     toTime: toDate.endOf("day").toJSDate() // DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.toTime as any).toJSDate()
  //   });

  //   /* set date based on the start date of the class schedule */
  //   if (this.setFromDate) {
  //     this.formGroup.get("fromDate").setValue(composedRRule.approximate.all()[0], { emitEvent: false });
  //   }

  //   // console.log("composedRRule total >> ", composedRRule.approximate.all().length);

  //   // console.log("composedRRule ", composedRRule);

  //   this.dateInterval = [];

  //   composedRRule.approximate.all().forEach((date, i) => {
  //     // this.scheduleItems.push({
  //     //   id: i,
  //     //   sectionID: sectionId,
  //     //   name: null, //"shift.title",
  //     //   start: moment(date).startOf("day"),
  //     //   end: moment(date).endOf("day"),
  //     //   classes: ""
  //     // });
  //     // console.log("date => ", date);

  //     const luxonDate = DateTime.fromJSDate(date);

  //     const isExistIndex = this.dateInterval.findIndex((d) => d.month === luxonDate.month && d.year === luxonDate.year);
  //     if (isExistIndex === -1) {
  //       this.dateInterval.push({ date: luxonDate, year: luxonDate.year, month: luxonDate.month, days: [{ enable: true, date: luxonDate }] });
  //     } else {
  //       this.dateInterval[isExistIndex].days.push({ enable: true, date: luxonDate });
  //     }
  //   });

  //   // const intervalDate = Interval.fromDateTimes(fromDate.startOf("month"), toDate.endOf("month"))
  //   //   .splitBy({ day: 1 })
  //   //   .map((d: Interval) => d.start)
  //   //   .filter((d) => includeDaysInAWeek.includes(d.weekday));

  //   // console.log("intervalDate ", Interval.fromDateTimes(fromDate.startOf("month"), toDate.endOf("month")).splitBy({ day: 1 }), intervalDate);

  //   // this.dateInterval = [];

  //   // intervalDate.forEach((id) => {
  //   //   const isExistIndex = this.dateInterval.findIndex((d) => d.month === id.month && d.year === id.year);
  //   //   if (isExistIndex === -1) {
  //   //     this.dateInterval.push({ date: id, year: id.year, month: id.month, days: [{ enable: true, date: id }] });
  //   //   } else {
  //   //     this.dateInterval[isExistIndex].days.push({ enable: true, date: id });
  //   //   }
  //   // });

  //   /* exclude previous days of month */
  //   // this.dateInterval.map((di) => {
  //   //   if (di.month === new Date().getMonth() + 1 && di.year === new Date().getFullYear()) {
  //   //     di.days = di.days.filter((d) => d.date.day >= new Date().getDate());
  //   //   }
  //   //   return di;
  //   // });

  //   // console.log("dateInterval", this.dateInterval);
  //   this.loadPricing(false);
  // }

  public setToDateBasedOnFromDate(): void {
    if (this.formGroup.value.paymentType === "monthly") {
      this.formGroup.get("toDate").setValue(DateTime.fromJSDate(this.formGroup.value.fromDate).endOf("month").toJSDate(), { emitEvent: false });
    }
  }

  public errorMessage: string = null;

  private loadPricing(loadDateInterval: boolean = true): void {
    const classData = this.classes.find((c) => c._id === this.formGroup.value.classId);
    console.log("classData", classData, this.formGroup.value.classId);
    if (classData) {
      this.formGroup.get("classTypeOfRate").setValue(classData.typeOfRate);
    }

    // console.log("loadPricing ", loadDateInterval);
    this.pricing = null;
    this.viewState = "loading";
    this.errorMessage = null;
    lastValueFrom(this.classesService.pricing(this.payload))
      .then((res) => {
        // console.log("res", res);
        // if (!res.success && this.showModal) {
        //   this.nzNotificationService.error("Enroll Student", res.message);
        // }
        if (res.success) {
          this.pricing = res.data;
          // this.setFromToDateFormGroup(loadDateInterval);
          if (loadDateInterval) {
            this.loadDateInterval();
          }
        } else {
          this.errorMessage = res.message;
        }
        // this.loadDateInterval();
      })
      .finally(() => {
        this.viewState = "initial";
      });
  }

  public studentHasStudentDebt: boolean = false;
  private checkIfStudentHasDebts(): void {
    this.studentHasStudentDebt = false;
    lastValueFrom(this.classesService.studentClassDebts(this.formGroup.value.studentId)).then((res) => {
      this.studentHasStudentDebt = res.success;
    });
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
        // this.nzNotificationService.create(res.success ? "success" : "error", "Enroll Student", res.message);
        if (res.success) {
          this.toggle();
          this.onSubmittedEmitter.emit(res.data);
        } else {
          this.nzNotificationService.error("Enroll Student", res.message);
        }
      })
      .finally(() => {
        this.viewState = "initial";
      });
  }

  public disabledPreviousDate = (current: Date): boolean =>
    differenceInCalendarDays(current, DateTime.fromISO(this.pricing.schedulesShift.startDate as any as string).toJSDate()) < 0;

  private get payload(): any {
    const days: { included: boolean; enable: boolean; day: number; month: number; year: number; paid: boolean; paymentType: string }[] = [];
    this.dateInterval.forEach((interval) => {
      interval.days.forEach((day) => {
        // if (day.enable) {
        days.push({
          included: day.included,
          enable: day.enable,
          day: day.date.day,
          month: day.date.month,
          year: day.date.year,
          paid: day.enable && day.included ? true : false,
          paymentType: day.enable ? this.formGroup.value.paymentType : null, // if the user disable the day it should not have a payment type
        });
        // }
      });
    });
    return {
      classId: this.formGroup.value.classId,
      studentId: this.formGroup.value.studentId,
      dates: days,
      discount: this.formGroup.value.discount,
      addition: typeof this.formGroup.value.addition === "string" ? parseInt(this.formGroup.value.addition) : this.formGroup.value.addition,
      subtraction: typeof this.formGroup.value.subtraction === "string" ? parseInt(this.formGroup.value.subtraction) : this.formGroup.value.subtraction,
      notes: this.formGroup.value.notes,
      newEnroll: true,
      payDebt: false,
    };
  }

  private resetForm(): void {
    this.formGroup.get("discount").reset(0, { emitEvent: false });
    this.formGroup.get("addition").reset(0, { emitEvent: false });
    this.formGroup.get("subtraction").reset(0, { emitEvent: false });
    this.formGroup.get("notes").reset(null, { emitEvent: false });
  }

  public showAllDaysOfClass: boolean = false;
  public toggleShowAllDaysOfClass(): void {
    // this.showAllDaysOfClass = !this.showAllDaysOfClass;
    this.loadDateInterval(); // refresh the dates
  }
}

export interface IPricing {
  originalTotalAmount: number;
  deductedTotalAmount: number;
  deductedTotalAmount2: number;
  subTotalAmount: number;
  totalOfClassDaysToPay: number;
  savingsBalance: number;
  savingsRemainingBalance: number;
  savingsRedundantBalance: number;
  savingsRedundantRemainingBalance: number;
  usedSavings: number;
  totalAddedDays: number;
  totalAmountOfAddedDays: number;
  totalUnpaidDays: number;
  totalAmountOfUnpaidDays: number;
  offDays: [];
  totalOfOffDays: number;
  totalAmountOfOffDays: number;
  monthlyPrice: number;
  hourlyMonthlyPrice: number;
  hourlyPackagePrice: number;
  discount: number;
  totalDiscount: number;
  fromDate: null;
  toDate: null;
  dates: IClassStudentRecord[];
  addition: number;
  subtraction: number;
  records: IClassStudentRecord[];
  schedulesShift: IScheduleSchedulesShift;
  firstDateEnrolled: IClassStudentRecord;
  lastDateEnrolled: IClassStudentRecord;
  lastEnrolledDaysMonth: IClassStudentRecord[];
  status: "stopped" | "inprogress";
}
