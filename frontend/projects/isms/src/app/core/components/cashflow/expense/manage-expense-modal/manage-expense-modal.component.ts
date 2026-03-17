import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ICourse } from "@isms-core/interfaces";
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
import { lastValueFrom } from "rxjs";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { SubSink } from "subsink";
import { CashflowExpenseFormGroup } from "@isms-core/form-group";
import { CashflowExpenseService } from "@isms-core/services";
import { NzTimePickerModule } from "ng-zorro-antd/time-picker";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { IncomeFrom, ModeOfPayment } from "@isms-core/constants";

@Component({
  selector: "isms-manage-expense-modal",
  templateUrl: "./manage-expense-modal.component.html",
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
  ],
})
export class ManageExpenseModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") onSubmitted: EventEmitter<ICourse> = new EventEmitter();
  public cashflowExpenseFormGroup: FormGroup = CashflowExpenseFormGroup();
  private subSink: SubSink = new SubSink();
  public loading: boolean = false;
  public showModal: boolean = false;

  public incomeFrom = IncomeFrom;
  public modeOfPayment = ModeOfPayment;

  constructor(
    private readonly cashflowExpenseService: CashflowExpenseService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {}

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  public toggle(): void {
    this.showModal = !this.showModal;
    this.cashflowExpenseFormGroup.reset();
  }

  public onCreate(): void {
    this.cashflowExpenseFormGroup.markAllAsTouched();
    if (this.cashflowExpenseFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.cashflowExpenseService.create({
          amount: this.cashflowExpenseFormGroup.value.amount,
          notes: this.cashflowExpenseFormGroup.value.notes,
          mode: this.cashflowExpenseFormGroup.value.mode,
        })
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Add Expense", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }

  public onUpdate(): void {
    // this.cashflowExpenseFormGroup.markAllAsTouched();
    // if (this.cashflowExpenseFormGroup.valid) {
    //   this.loading = true;
    //   lastValueFrom(
    //     this.cashflowExpenseService.updateById(
    //       {
    //         name: this.cashflowExpenseFormGroup.value.name,
    //         price: this.cashflowExpenseFormGroup.value.price,
    //         quantity: this.cashflowExpenseFormGroup.value.quantity
    //       },
    //       this.cashflowExpenseFormGroup.value._id
    //     )
    //   ).then((res) => {
    //     this.loading = false;
    //     if (res.success) {
    //       this.toggle();
    //       this.showModal = false;
    //       this.onSubmitted.emit(res.data);
    //     }
    //     this.nzNotificationService.create(res.success ? "success" : "error", "Update Expense", res.message, { nzPlacement: "bottomRight" });
    //   });
    // }
  }
}
