import { DatePipe, NgFor } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IClassTime } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { ClassesTimeService, NGRXService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { ManageTimeModalComponent } from "../manage-time-modal/manage-time-modal.component";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";

@Component({
  selector: "isms-time-listing",
  templateUrl: "./time-listing.component.html",
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
    ManageTimeModalComponent,
  ],
})
export class TimeListingComponent {
  @ViewChild("manageTimeModal") manageTimeModal: ManageTimeModalComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  private times: Array<IClassTime> = [];
  public filteredTimes: Array<IClassTime> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });

  constructor(
    private readonly classesTimeService: ClassesTimeService,
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
          this.filteredTimes = this.find(this.times, value);
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
    lastValueFrom(this.classesTimeService.fetch({ limit: 100 })).then((res) => {
      if (res.success) {
        this.setStudents(res.data);
      } else {
        this.resetStudents();
      }
    });
  }

  public onEdit(id: string): void {
    this.manageTimeModal.timeId = id;
    this.manageTimeModal.toggle();
  }

  public onDelete(id: string): void {
    lastValueFrom(this.classesTimeService.delete(id)).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Delete Class", res.message, { nzPlacement: "bottomRight" });
      this.loadData();
    });
  }

  public identify = (index: number, item: IClassTime) => {
    return item._id;
  };

  public onSubmitted(value: IClassTime): void {
    this.times.unshift(value);
    this.filteredTimes.unshift(value);
  }

  private setStudents(values: Array<IClassTime>): void {
    this.times = values;
    this.filteredTimes = values;
  }

  private resetStudents(): void {
    this.times = [];
    this.filteredTimes = [];
  }
}
