import { DatePipe, NgFor } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IClass, ICourse } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { ClassesService, NGRXService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { ManageClassModalComponent } from "../manage-class-modal/manage-class-modal.component";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { FormattedCurrencyPipe } from "@isms-core/pipes";

@Component({
  selector: "isms-class-listing",
  templateUrl: "./class-listing.component.html",
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
    FormattedCurrencyPipe,
    ManageClassModalComponent,
  ],
})
export class ClassListingComponent {
  @ViewChild("manageClassModal") manageClassModal: ManageClassModalComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  private classes: Array<IClass> = [];
  public filteredClasses: Array<IClass> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });

  constructor(
    private readonly classesService: ClassesService,
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
          this.filteredClasses = this.find(this.classes, value);
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
    lastValueFrom(this.classesService.fetch({ limit: 1000 })).then((res) => {
      if (res.success) {
        this.setStudents(res.data);
      } else {
        this.resetStudents();
      }
    });
  }

  public onEdit(id: string): void {
    this.manageClassModal.toggle(id);
  }

  public onDelete(id: string): void {
    lastValueFrom(this.classesService.delete(id)).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Delete Class", res.message, { nzPlacement: "bottomRight" });
      this.loadData();
    });
  }

  public identify = (index: number, item: ICourse) => {
    return item._id;
  };

  public onSubmitted(course: IClass): void {
    this.classes.unshift(course);
    this.filteredClasses.unshift(course);
  }

  private setStudents(students: Array<IClass>): void {
    const mapped = students.map((student) => {
      return student;
    });
    this.classes = mapped;
    this.filteredClasses = mapped;
  }

  private resetStudents(): void {
    this.classes = [];
    this.filteredClasses = [];
  }
}
