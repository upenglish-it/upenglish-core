import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { StaffSalaryAdvancementFormGroup } from "@isms-core/form-group";
import { StaffSalaryAdvancement } from "@isms-core/interfaces";
import { LeavesService, SchedulesShiftsService, StaffsService } from "@isms-core/services";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzSelectModule } from "ng-zorro-antd/select";
import { lastValueFrom } from "rxjs";

@Component({
  selector: "isms-manage-salary-advancement",
  templateUrl: "./manage-salary-advancement.component.html",
  imports: [NgIf, NgFor, JsonPipe, ReactiveFormsModule, NzModalModule, NzInputModule, NzInputNumberModule, NzButtonModule, NzIconModule, NzDatePickerModule, NzSelectModule],
})
export class ManageSalaryAdvancementComponent implements OnInit {
  @Input("staff-id") staffId: string;
  @Input("view") view: "form" | "selector";
  @Input("form-group") staffSalaryAdvancementFormGroup: FormGroup;
  @Output("on-submitted") onSubmitted: EventEmitter<void> = new EventEmitter<void>();

  public showDrawer: boolean = false;
  public loading: boolean = false;

  constructor(
    private readonly nzNotificationService: NzNotificationService,
    private readonly staffsService: StaffsService
  ) {}

  public ngOnInit(): void {
    this.loadFormView();
  }

  private loadFormView(): void {
    lastValueFrom(this.staffsService.fetchSalaryAdvancement(this.staffId)).then((res) => {
      if (res.success) {
        this.setStaffSalaryAdvancement(res.data);
      }
    });
  }

  public toggle(): void {
    this.showDrawer = !this.showDrawer;
  }

  public onSubmit(): void {}

  private setStaffSalaryAdvancement(salaryAdvancement: StaffSalaryAdvancement): void {
    const remainingBalance = salaryAdvancement.loanedAmount - salaryAdvancement.paidAmount;
    this.staffSalaryAdvancementFormGroup.reset({
      ...salaryAdvancement,
      payNow: salaryAdvancement.paymentSequence + 1 >= salaryAdvancement.agreement.every && remainingBalance > 0,
      remainingBalance: remainingBalance,
    });
  }

  public onSetSalaryAdvancement(): void {
    lastValueFrom(
      this.staffsService.setSalaryAdvancement(this.staffId, {
        loanedAmount: this.staffSalaryAdvancementFormGroup.value.loanedAmount,
        agreement: this.staffSalaryAdvancementFormGroup.value.agreement,
      })
    ).then((res) => {
      if (res.success) {
        this.setStaffSalaryAdvancement(res.data);
      }
      this.nzNotificationService.create(res.success ? "success" : "error", "Salary Advancement", res.message, { nzPlacement: "bottomRight" });
    });
  }
}
