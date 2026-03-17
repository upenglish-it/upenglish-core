import { DatePipe, NgFor } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IAccount, ICashflow } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { CashflowExpenseService, NGRXService, StaffsService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { ManageExpenseModalComponent } from "../manage-expense-modal/manage-expense-modal.component";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { DateTime } from "luxon";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { FormattedCurrencyPipe } from "@isms-core/pipes";

@Component({
  selector: "isms-expense-listing",
  templateUrl: "./expense-listing.component.html",
  imports: [
    NgFor,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    NzTagModule,
    NzInputModule,
    NzDropDownModule,
    NzButtonModule,
    NzCheckboxModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzDatePickerModule,
    ManageExpenseModalComponent,
    ProfilePhotoDirective,
    FormattedCurrencyPipe,
  ],
})
export class ExpenseListingComponent {
  @ViewChild("manageIncomeModal") manageIncomeModal: ManageExpenseModalComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  private cashflows: Array<ICashflow> = [];
  public filteredCashflows: Array<ICashflow> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
    staffs: new FormControl([]),
    startEndDate: new FormControl([DateTime.now().minus({ months: 1 }).toJSDate(), new Date()]),
  });
  public receivers: Array<IAccount> = [];

  constructor(
    private readonly cashflowExpenseService: CashflowExpenseService,
    private readonly staffsService: StaffsService,
    private readonly ngrxService: NGRXService,
    private readonly nzNotificationService: NzNotificationService
  ) {
    this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));
  }

  public ngOnInit(): void {
    this.loadData();
    this.subSink.add(
      this.filterFormGroup
        .get("searchQuery")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe((value) => {
          this.filteredCashflows = this.find(this.cashflows, value);
        })
    );

    this.subSink.add(
      this.filterFormGroup
        .get("staffs")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe(() => {
          this.loadExpense();
        })
    );

    this.subSink.add(
      this.filterFormGroup
        .get("startEndDate")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe(() => {
          this.loadExpense();
        })
    );
  }

  /* Temporary search filter. Refactor this later */
  private find(arr: any[], pat: string) {
    let pa = pat
      .trim()
      .replace(/ +/g, " ")
      .split(" ")
      .map((p: string | RegExp) => new RegExp(p, "i"));
    return arr.filter((n: { name: string }) => {
      let name = n.name;
      return pa.every((p: { test: (arg0: string) => any }) => p.test(name));
    });
  }

  public async loadData(): Promise<void> {
    this.loadExpense();
    lastValueFrom(
      this.staffsService.fetch({
        limit: 100,
        includeMe: true,
      })
    ).then((res) => {
      this.receivers = res.success ? res.data : [];
    });

    // lastValueFrom(this.cashflowExpenseService.fetch({ limit: 100 })).then((res) => {
    //   if (res.success) {
    //     this.setStudents(res.data);
    //   } else {
    //     this.resetStudents();
    //   }
    // });
  }

  private loadExpense(): void {
    lastValueFrom(
      this.cashflowExpenseService.fetch({
        limit: 100,
        staffs: this.filterFormGroup.value.staffs,
        startEndDate: (this.filterFormGroup.value.startEndDate as Array<Date>).map((d, index) => {
          return index <= 0 ? d.toISOString() : new Date().toISOString();
        }),
      })
    ).then((res) => {
      if (res.success) {
        this.setStudents(res.data);
      } else {
        this.resetStudents();
      }
    });
  }

  public onEdit(id: string): void {
    this.manageIncomeModal.toggle();
  }

  public onDelete(id: string): void {
    lastValueFrom(this.cashflowExpenseService.delete(id)).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Delete Item", res.message, { nzPlacement: "bottomRight" });
      this.loadData();
    });
  }

  public identify = (index: number, item: ICashflow) => {
    return item._id;
  };

  public onSubmitted(value: ICashflow): void {
    this.cashflows.unshift(value);
    this.filteredCashflows.unshift(value);
  }

  private setStudents(values: Array<ICashflow>): void {
    this.cashflows = values;
    this.filteredCashflows = values;
  }

  private resetStudents(): void {
    this.cashflows = [];
    this.filteredCashflows = [];
  }
}
