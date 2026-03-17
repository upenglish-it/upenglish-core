import { DatePipe, NgFor } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IAccount, ICashflow } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { CashflowIncomeService, NGRXService, StaffsService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { ManageIncomeModalComponent } from "../manage-income-modal/manage-income-modal.component";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzSelectModule } from "ng-zorro-antd/select";
import { isEmpty } from "lodash";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { DateTime } from "luxon";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { FormattedCurrencyPipe } from "@isms-core/pipes";
import { NzIconModule } from "ng-zorro-antd/icon";

@Component({
  selector: "isms-income-listing",
  templateUrl: "./income-listing.component.html",
  imports: [
    NgFor,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    NzTagModule,
    NzIconModule,
    NzInputModule,
    NzDropDownModule,
    NzButtonModule,
    NzCheckboxModule,
    NzPopconfirmModule,
    FormattedCurrencyPipe,
    NzSelectModule,
    NzDatePickerModule,
    ManageIncomeModalComponent,
    ProfilePhotoDirective,
  ],
})
export class IncomeListingComponent {
  @ViewChild("manageIncomeModal") manageIncomeModal: ManageIncomeModalComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  public account: IAccount = null;
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
    private readonly cashflowIncomeService: CashflowIncomeService,
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
          this.loadIncome();
        })
    );

    this.subSink.add(
      this.filterFormGroup
        .get("startEndDate")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe(() => {
          this.loadIncome();
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

  public loadData(): void {
    this.loadIncome();
    lastValueFrom(
      this.staffsService.fetch({
        limit: 100,
        includeMe: true,
      })
    ).then((res) => {
      this.receivers = res.success ? res.data : [];
    });
  }

  private loadIncome(): void {
    lastValueFrom(
      this.cashflowIncomeService.fetch({
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
    lastValueFrom(this.cashflowIncomeService.delete(id)).then((res) => {
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

  public isNotSelectedReceiverFilter(id: string): boolean {
    return isEmpty(this.receivers.find((r) => r._id === id));
  }
}
