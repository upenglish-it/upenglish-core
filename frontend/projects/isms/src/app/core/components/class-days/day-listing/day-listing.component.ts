import { DatePipe, NgFor } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IClassDay } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { ClassesDaysService, NGRXService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { ManageDayModalComponent } from "../manage-day-modal/manage-day-modal.component";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { DaysToStringFormatPipe } from "@isms-core/pipes";

@Component({
  selector: "isms-day-listing",
  templateUrl: "./day-listing.component.html",
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
    ManageDayModalComponent,
    DaysToStringFormatPipe,
  ],
})
export class DayListingComponent {
  @ViewChild("manageDayModal") manageDayModal: ManageDayModalComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  private days: Array<IClassDay> = [];
  public filteredDays: Array<IClassDay> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });

  constructor(
    private readonly classesDaysService: ClassesDaysService,
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
          this.filteredDays = this.find(this.days, value);
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
    lastValueFrom(this.classesDaysService.fetch({ limit: 100 })).then((res) => {
      if (res.success) {
        this.setStudents(res.data);
      } else {
        this.resetStudents();
      }
    });
  }

  public onEdit(id: string): void {
    this.manageDayModal.dayId = id;
    this.manageDayModal.toggle();
  }

  public onDelete(id: string): void {
    lastValueFrom(this.classesDaysService.delete(id)).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Delete Day", res.message, { nzPlacement: "bottomRight" });
      this.loadData();
    });
  }

  public identify = (index: number, item: IClassDay) => {
    return item._id;
  };

  public onSubmitted(value: IClassDay): void {
    this.days.unshift(value);
    this.filteredDays.unshift(value);
  }

  private setStudents(values: Array<IClassDay>): void {
    this.days = values;
    this.filteredDays = values;
  }

  private resetStudents(): void {
    this.days = [];
    this.filteredDays = [];
  }
}
