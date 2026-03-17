import { DatePipe, NgClass, NgFor, NgIf, TitleCasePipe } from "@angular/common";
import { Component, TemplateRef, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IClass, IClassChangeLog, IClassPaymentHistory, IClassStudent, IClassStudentRecord } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { StudentInfoDrawerComponent } from "../student-info-drawer/student-info-drawer.component";
import { ClassesService, NGRXService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { DateTime } from "luxon";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzNotificationComponent } from "ng-zorro-antd/notification";
import { EnrollNewStudentModalComponent } from "../enroll-new-student-modal/enroll-new-student-modal.component";
import { PayTuitionModalComponent } from "../pay-tuition-modal/pay-tuition-modal.component";
import { StopLearningModalComponent } from "../stop-learning-modal/stop-learning-modal.component";
import { FormattedCurrencyPipe } from "@isms-core/pipes";
import { isEmpty, sortBy } from "lodash";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzModalService } from "ng-zorro-antd/modal";
import { NzSpinModule } from "ng-zorro-antd/spin";
import { PaymentHistoryModalComponent } from "../payment-history-modal/payment-history-modal.component";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { ReachScrollToBottomDirective } from "@isms-core/directives";

@Component({
  selector: "isms-tuition-listing",
  templateUrl: "./tuition-listing.component.html",
  imports: [
    NgClass,
    NgIf,
    NgFor,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    NzTagModule,
    NzInputModule,
    NzDropDownModule,
    NzButtonModule,
    NzCheckboxModule,
    NzSelectModule,
    NzDatePickerModule,
    NzInputNumberModule,
    NzIconModule,
    NzSwitchModule,
    NzToolTipModule,
    NzTagModule,
    NzSpinModule,
    StudentInfoDrawerComponent,
    EnrollNewStudentModalComponent,
    PayTuitionModalComponent,
    PaymentHistoryModalComponent,
    StopLearningModalComponent,
    FormattedCurrencyPipe,
    TitleCasePipe,
    ReachScrollToBottomDirective,
  ],
})
export class TuitionListingComponent {
  @ViewChild("payTuitionModal") payTuitionModal: PayTuitionModalComponent;
  @ViewChild("enrollNewStudentModal") enrollNewStudentModal: EnrollNewStudentModalComponent;
  @ViewChild("paymentHistoryModal") paymentHistoryModal: PaymentHistoryModalComponent;
  @ViewChild("stopLearningModal") stopLearningModal: StopLearningModalComponent;
  @ViewChild("studentInfoDrawer") studentInfoDrawer: StudentInfoDrawerComponent;

  private subSink: SubSink = new SubSink();
  public students: Array<IClassStudent> = [];
  public classes: Array<IClass> = [];

  public filterFormGroup: FormGroup = new FormGroup({
    classId: new FormControl(null),
    date: new FormControl(DateTime.now().toJSDate()),
    amount: new FormControl(20000),
  });

  public viewState: "initial" | "loading-tuition-listing" = "initial";
  public isLoadingMore = false;
  public hasMore = true;
  private currentPage = 1;
  private readonly pageLimit = 50;

  constructor(
    private readonly classesService: ClassesService,
    private readonly ngrxService: NGRXService,
    private readonly notificationService: NzNotificationService,
    private readonly nzModalService: NzModalService
  ) {}

  public ngOnInit(): void {
    this.loadData();
    this.subSink.add(
      this.filterFormGroup.valueChanges.pipe(distinctUntilChanged(), debounceTime(100)).subscribe(() => {
        this.setTuitionListing();
      })
    );
  }

  // Fetches the classes dropdown (no pagination needed), then triggers the first student fetch.
  public loadData(): void {
    lastValueFrom(this.classesService.fetch()).then((res) => {
      this.classes = [];
      if (res.success) {
        this.classes = res.data;
        // Auto-select the first class on initial load if no class is currently set
        if (res.data.length > 0 && !this.filterFormGroup.value.classId) {
          this.filterFormGroup.get("classId").setValue(res.data[0]._id, { emitEvent: false });
        }
        this.setTuitionListing();
      }
    });
  }

  // Resets pagination and fetches page 1 of students for the selected class/month.
  // Called on filter change, after enroll/pay/revert actions, and on initial load.
  public setTuitionListing(): void {
    this.currentPage = 1;
    this.hasMore = true;
    this.students = [];
    this.viewState = "loading-tuition-listing";
    this.fetchStudents(false).finally(() => {
      this.viewState = "initial";
    });
  }

  // Triggered by scroll-to-bottom — appends the next page of students.
  public loadMore(): void {
    if (this.isLoadingMore || !this.hasMore) return;
    this.isLoadingMore = true;
    this.fetchStudents(true).finally(() => {
      this.isLoadingMore = false;
    });
  }

  private async fetchStudents(append: boolean): Promise<void> {
    const res = await lastValueFrom(
      this.classesService.tuitionStudents({
        classId: this.filterFormGroup.value.classId,
        date: DateTime.fromJSDate(this.filterFormGroup.value.date).toFormat("MM-yyyy"),
        amount: this.filterFormGroup.value.amount,
        page: this.currentPage,
        limit: this.pageLimit,
      })
    );

    if (!res.success) {
      this.hasMore = false;
      return;
    }

    const raw: Array<IClassStudent> = res.data?.items ?? res.data ?? [];

    const mapped = raw.map((student) => {
      if (student.status === "stopped") {
        student.records = student.records.filter((r) => !r.stoppedLearning);
      }

      // Collapse debt records by month, summing amounts per month
      const dates: Array<IClassStudentRecord> = [];
      student.debtRecords.forEach((date) => {
        const exist = dates.find(
          (d) => DateTime.fromISO(date.date).month === DateTime.fromISO(d.date).month && DateTime.fromISO(date.date).year === DateTime.fromISO(d.date).year
        );
        const totalDebtRecords = student.debtRecords.filter(
          (d) => DateTime.fromISO(date.date).month === DateTime.fromISO(d.date).month && DateTime.fromISO(date.date).year === DateTime.fromISO(d.date).year
        );
        if (isEmpty(exist)) {
          dates.push({ ...date, totalAmount: totalDebtRecords.reduce((pv, cv) => pv + cv.amount, 0) });
        }
      });

      student.debtRecords = dates;
      student.totalDebtAmount = dates.reduce((pv, cv) => pv + cv.totalAmount, 0);
      student["monthHasUnPaid"] = student.status === "ongoing" && student.records.filter((r) => !r.paid).length > 0;
      student.paymentHistory = sortBy(student.paymentHistory).reverse();
      student.changeLogs = sortBy(student.changeLogs);
      student.discount = 0;

      const paidRecords = student.records.filter((r) => r.paid && r.included);
      student.totalAmountPaid = paidRecords.reduce((pv, cv) => cv.amount + pv, 0);
      student.totalOfUnpaidDays = student.records.filter((r) => r.enable && !r.paid).length;

      return student;
    });

    this.hasMore = mapped.length === this.pageLimit;
    this.currentPage++;
    this.students = append ? [...this.students, ...mapped] : mapped;
  }

  public onEdit(id: string): void {
    this.studentInfoDrawer.studentId = id;
    this.studentInfoDrawer.toggle();
  }

  public identify = (index: number, item: IClassStudent) => {
    return item.account._id;
  };

  public enrollNewStudent(): void {
    this.enrollNewStudentModal.defaultFormValue();
    this.enrollNewStudentModal.toggle();

    const filteredDate = DateTime.fromJSDate(this.filterFormGroup.value.date).startOf("month");
    this.enrollNewStudentModal.formGroup.get("tuitionListingFilteredDate").setValue(filteredDate.toJSDate(), { emitEvent: false });
    this.enrollNewStudentModal.setFromDateAndToDate();
  }

  public onPayDebt(cantPayThisMonth: boolean, student: IClassStudent): void {
    this.payTuitionModal.student = student;
    const filteredDate = DateTime.fromJSDate(this.filterFormGroup.value.date).startOf("month");
    this.payTuitionModal.formGroup.get("tuitionListingFilteredDate").setValue(filteredDate.toJSDate(), { emitEvent: false });
    this.payTuitionModal.setFromDateAndToDate();
    this.payTuitionModal.formGroup.get("includeNextMonthInPayment").setValue(true, { emitEvent: false });
    this.payTuitionModal.formGroup.get("cantPayThisMonth").setValue(cantPayThisMonth, { emitEvent: false });

    this.payTuitionModal.formGroup.get("studentId").setValue(student.student);
    this.payTuitionModal.formGroup.get("studentClassId").setValue(student._id);
    this.payTuitionModal.formGroup.get("classId").setValue(student.classes);

    this.payTuitionModal.enableDisable(false);
    this.payTuitionModal.payDebtOnly = true;

    this.payTuitionModal.toggle();
  }

  public onPayTuition(cantPayThisMonth: boolean, student: IClassStudent): void {
    this.payTuitionModal.enableDisable(true);
    this.payTuitionModal.student = student;

    const filteredDate = DateTime.fromJSDate(this.filterFormGroup.value.date).startOf("month");
    this.payTuitionModal.formGroup.get("tuitionListingFilteredDate").setValue(filteredDate.toJSDate(), { emitEvent: false });
    this.payTuitionModal.setFromDateAndToDate();
    this.payTuitionModal.formGroup.get("includeNextMonthInPayment").setValue(true, { emitEvent: false });
    this.payTuitionModal.formGroup.get("cantPayThisMonth").setValue(cantPayThisMonth, { emitEvent: false });

    this.payTuitionModal.formGroup.get("studentId").setValue(student.student);
    this.payTuitionModal.formGroup.get("studentClassId").setValue(student._id);
    this.payTuitionModal.formGroup.get("classId").setValue(student.classes);

    this.payTuitionModal.formGroup.get("skipDebt").setValue(false, { emitEvent: false });

    if (student.debtRecords.length === 0) {
      this.payTuitionModal.formGroup.get("includeNextMonthInPayment").disable();
    }

    if (student.debtRecords.length > 0) {
      this.payTuitionModal.formGroup.get("skipDebt").setValue(false);
    }

    this.payTuitionModal.resetForm();
    this.payTuitionModal.toggle();

    if (student.debtRecords.length > 0) {
      this.payTuitionModal.formGroup.get("paymentType").setValue(student.debtRecords.at(0).paymentType || "monthly", { emitEvent: false });
    }

    setTimeout(() => {
      this.payTuitionModal.draftTuitionModalComponent.formGroup.get("studentClassId").setValue(student._id);
    }, 1000);
  }

  public stopLearning(reason: "leave-without-notice" | "cant-pay", student: IClassStudent): void {
    this.stopLearningModal.formGroup.get("studentId").setValue(student.student);
    this.stopLearningModal.formGroup.get("studentClassId").setValue(student._id);
    this.stopLearningModal.formGroup.get("classId").setValue(student.classes);
    this.stopLearningModal.formGroup.get("reason").setValue(reason);
    this.stopLearningModal.toggle();
  }

  public paymentHistory(student: IClassStudent): IClassPaymentHistory {
    const paymentHistoryId = student.records[0].paymentHistoryId;
    const paymentHistoryIndex = student.paymentHistory.findIndex((ph) => ph.id === paymentHistoryId);
    return student.paymentHistory.at(paymentHistoryIndex);
  }

  public onTuitionPayment(data: { paymentHistory: IClassPaymentHistory }): void {
    this.notificationService.template(this.tuitionPaymentReceiptTemplate! as any, {
      nzPlacement: "bottomRight",
      nzData: { urlCode: data.paymentHistory.urlCode },
    });
    this.setTuitionListing();
  }

  @ViewChild("tuitionPaymentReceiptTemplate", { static: true }) tuitionPaymentReceiptTemplate!: TemplateRef<{ $implicit: NzNotificationComponent }>;
  public onViewReceipts(paymentHistory: IClassPaymentHistory): void {
    window.open(`/pop/student-receipt?urlCode=${paymentHistory.urlCode}`, "_blank");
  }

  public onViewPaymentHistory(paymentHistory: IClassPaymentHistory, student: IClassStudent): void {
    this.paymentHistoryModal.formGroup.get("studentId").setValue(student.student);
    this.paymentHistoryModal.formGroup.get("studentClassId").setValue(student._id);
    this.paymentHistoryModal.formGroup.get("classId").setValue(student.classes);

    this.paymentHistoryModal.paymentHistory = paymentHistory;
    this.paymentHistoryModal.student = student;

    this.paymentHistoryModal.toggle();
  }

  public onViewVersions(studentClassId: string, changeLog: IClassChangeLog): void {
    if (!isEmpty(changeLog)) {
      this.nzModalService.confirm({
        nzBodyStyle: { "padding-left": "16px", "padding-right": "16px", "padding-bottom": "10px", "padding-top": "16px" },
        nzTitle: `Do you want to revert to this version? <span class="font-medium">${DateTime.fromISO(changeLog.dateCreated).toFormat("MMM, dd, yyyy hh:mm:s a")}</span>`,
        nzOkText: "Confirm",
        nzOkType: "primary",
        nzOkDanger: true,
        nzCancelText: "No, Leave it",
        nzOnCancel: () => {},
        nzOnOk: () => {
          lastValueFrom(this.classesService.setVersion(studentClassId, { versionId: changeLog.id })).then(() => {
            this.setTuitionListing();
          });
        },
      });
    } else {
      this.nzModalService.confirm({
        nzBodyStyle: { "padding-left": "16px", "padding-right": "16px", "padding-bottom": "10px", "padding-top": "16px" },
        nzTitle: `Do you want to revert from the start?`,
        nzOkText: "Confirm",
        nzOkType: "primary",
        nzOkDanger: true,
        nzCancelText: "No, Leave it",
        nzOnCancel: () => {},
        nzOnOk: () => {
          lastValueFrom(this.classesService.setVersion(studentClassId, { versionId: null })).then(() => {
            this.setTuitionListing();
          });
        },
      });
    }
  }

  public viewStudent(id: string): void {
    this.studentInfoDrawer.studentId = id;
    this.studentInfoDrawer.toggle();
  }
}
