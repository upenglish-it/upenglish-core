import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { IAccount, IClassStudent, ICourse, IMaterial } from "@isms-core/interfaces";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NgFor, NgIf } from "@angular/common";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { SubSink } from "subsink";
import { CashflowIncomeFormGroup } from "@isms-core/form-group";
import { CashflowIncomeService, ClassesService, MaterialsService, StudentsService } from "@isms-core/services";
import { NzTimePickerModule } from "ng-zorro-antd/time-picker";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { IncomeFrom, ModeOfPayment } from "@isms-core/constants";
import { first, isEmpty } from "lodash";
import { FormattedCurrencyPipe } from "@isms-core/pipes";

@Component({
  selector: "isms-manage-income-modal",
  templateUrl: "./manage-income-modal.component.html",
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    NzDrawerModule,
    NzModalModule,
    NzButtonModule,
    NzInputModule,
    NzTagModule,
    NzSelectModule,
    NzIconModule,
    NzToolTipModule,
    NzDatePickerModule,
    NzTimePickerModule,
    NzInputNumberModule,
    FormattedCurrencyPipe,
  ],
})
export class ManageIncomeModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") onSubmitted: EventEmitter<ICourse> = new EventEmitter();
  public cashflowIncomeFormGroup: FormGroup = CashflowIncomeFormGroup();
  private subSink: SubSink = new SubSink();
  public loading: boolean = false;
  public showModal: boolean = false;

  public incomeFrom = IncomeFrom;
  public modeOfPayment = ModeOfPayment;
  public materials: Array<IMaterial> = [];
  public students: Array<IAccount> = [];

  public selectedStudent: IAccount | null = null;
  public selectedStudentBreakdown: { name: string }[] = [];

  constructor(
    private readonly studentsService: StudentsService,
    private readonly materialsService: MaterialsService,
    private readonly cashflowIncomeService: CashflowIncomeService,
    private readonly classesService: ClassesService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {
    lastValueFrom(
      this.studentsService.fetch({
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

    lastValueFrom(this.materialsService.fetch()).then((res) => {
      this.materials = res.success ? res.data : [];
    });

    this.subSink.add(
      this.cashflowIncomeFormGroup
        .get("materialId")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe((value) => {
          const material = this.materials.find((m) => m._id === value);
          if (!isEmpty(material)) {
            this.cashflowIncomeFormGroup.get("amount").setValue(material.price);
          }
        }),

      this.cashflowIncomeFormGroup
        .get("studentId")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe((value) => {
          this.selectedStudent = this.students.find((s) => s._id === value);
          if (this.selectedStudent) {
            this.classesService.breakdown({ studentId: value }).subscribe((res) => {
              console.log(">>>", res);
              if (res.success) {
                const selectedStudentBreakdown = (res.data as Array<IClassStudent>).map((data) => {
                  // const debtRecords: Array<IClassStudentRecord> = [];

                  // data.debtRecords.forEach((record: IClassStudentRecord) => {
                  //   const date = DateTime.fromObject({ day: record.day, month: record.month, year: record.year });

                  //   const exist = debtRecords.find((dr) => {
                  //     const drDate = DateTime.fromObject({ day: dr.day, month: dr.month, year: dr.year });
                  //     return drDate.month === date.month && drDate.year === date.year;
                  //   });

                  //   const totalAmount = data.debtRecords
                  //     .filter((dr) => {
                  //       const drDate = DateTime.fromObject({ day: dr.day, month: dr.month, year: dr.year });
                  //       return drDate.month === date.month && drDate.year === date.year;
                  //     })
                  //     .reduce((pv, cv) => pv + cv.amount, 0);

                  //   // const totalDebtRecords = data.debtRecords.filter(
                  //   //   (d) => DateTime.fromISO(date.date).month === DateTime.fromISO(d.date).month && DateTime.fromISO(date.date).year === DateTime.fromISO(d.date).year
                  //   // );

                  //   if (isEmpty(exist)) {
                  //     debtRecords.push({ ...record, date: date.toISO(), totalAmount: totalAmount } as any);
                  //   }
                  // });

                  return {
                    name: data.class.name,
                    // active: true,
                    // status: data.status,
                    // course: data.course,
                    // totalAmountNotPaid: data.totalAmountNotPaid,
                    // totalAmountPaid: data.totalAmountPaid,
                    // lastAttendance: DateTime.local(data.latestRecord.year, data.latestRecord.month, data.latestRecord.day).toJSDate(),
                    // debtRecords: debtRecords,
                    // totalDays: data.records.length,
                    // createdAt: data.createdAt
                  };
                });

                this.selectedStudentBreakdown = [first(selectedStudentBreakdown)];
              } else {
                this.selectedStudentBreakdown = [];
              }
            });
          }
        })
    );
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  private loadData(): void {
    this.loading = true;
    // lastValueFrom(this.materialsService.fetchById(this.materialId)).then((res) => {
    //   this.loading = false;
    //   if (res.success) {
    //     this.cashflowIncomeFormGroup.get("_id").setValue(res.data._id);
    //     this.cashflowIncomeFormGroup.get("name").setValue(res.data.name);
    //     this.cashflowIncomeFormGroup.get("price").setValue(res.data.price);
    //     this.cashflowIncomeFormGroup.get("quantity").setValue(res.data.quantity);
    //   }
    // });
  }

  public toggle(): void {
    this.showModal = !this.showModal;
    this.cashflowIncomeFormGroup.reset();
    // if (this.showModal && this.materialId) {
    //   this.loadData();
    // }
  }

  public onCreate(): void {
    this.cashflowIncomeFormGroup.markAllAsTouched();
    if (this.cashflowIncomeFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.cashflowIncomeService.create({
          from: this.cashflowIncomeFormGroup.value.from,
          materialId: this.cashflowIncomeFormGroup.value.materialId,
          studentId: this.cashflowIncomeFormGroup.value.studentId,
          amount: this.cashflowIncomeFormGroup.value.amount,
          quantity: this.cashflowIncomeFormGroup.value.quantity,
          notes: this.cashflowIncomeFormGroup.value.notes,
          mode: this.cashflowIncomeFormGroup.value.mode,
        })
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Add Income", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }

  public onUpdate(): void {
    this.cashflowIncomeFormGroup.markAllAsTouched();
    if (this.cashflowIncomeFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.materialsService.updateById(
          {
            name: this.cashflowIncomeFormGroup.value.name,
            price: this.cashflowIncomeFormGroup.value.price,
            quantity: this.cashflowIncomeFormGroup.value.quantity,
          },
          this.cashflowIncomeFormGroup.value._id
        )
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Update Material", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }

  public get totalPrice(): number {
    return this.cashflowIncomeFormGroup.value.amount * this.cashflowIncomeFormGroup.value.quantity;
  }
}
