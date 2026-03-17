import { DatePipe, NgClass, NgFor, NgIf, SlicePipe } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IAccount, IAccountClass } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { StudentInfoDrawerComponent } from "../student-info-drawer/student-info-drawer.component";
import { NGRXService, StudentsService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { AddStudentManuallyModalComponent } from "../add-student-manually-modal/add-student-manually-modal.component";
import { ManageStudentFilterComponent } from "../manage-student-filter/manage-student-filter.component";
import { ImportStudentFromCSVDrawerComponent } from "../import-student-from-csv-drawer/import-student-from-csv-drawer.component";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { ExportJSONToCSVDirective, ProfilePhotoDirective, ReachScrollToBottomDirective } from "@isms-core/directives";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzIconModule } from "ng-zorro-antd/icon";

@Component({
  selector: "isms-student-listing",
  templateUrl: "./student-listing.component.html",
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    NgClass,
    SlicePipe,
    NzTagModule,
    NzInputModule,
    NzIconModule,
    NzDropDownModule,
    NzButtonModule,
    NzCheckboxModule,
    AddStudentManuallyModalComponent,
    ManageStudentFilterComponent,
    ImportStudentFromCSVDrawerComponent,
    StudentInfoDrawerComponent,
    ProfilePhotoDirective,
    ExportJSONToCSVDirective,
    ReachScrollToBottomDirective,
  ],
})
export class StudentListingComponent {
  @ViewChild("studentInfoDrawer") studentInfoDrawer: StudentInfoDrawerComponent;
  @ViewChild("addStudentManuallyModal") addStudentManuallyModal: AddStudentManuallyModalComponent;

  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  private students: Array<IAccount> = [];
  public filteredStudents: Array<IAccount> = [];

  public isLoadingMore = false;
  public isLoading = true;
  public hasMore = true;
  private currentPage = 1;
  private readonly pageLimit = 50;
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });

  constructor(
    private readonly studentsService: StudentsService,
    private readonly ngrxService: NGRXService
  ) {
    this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));
  }
  public ngOnInit(): void {
    this.currentPage = 1;
    this.hasMore = true;
    this.loadData();
    this.subSink.add(
      this.filterFormGroup
        .get("searchQuery")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe((value) => {
          this.filteredStudents = this.find(this.students, value);
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
    return arr.filter((n: { firstName: string; lastName: string }) => {
      let name = n.firstName + " " + n.lastName;
      return pa.every((p: { test: (arg0: string) => any }) => p.test(name));
    });
  }
  public async loadData(): Promise<void> {
    this.isLoading = true;
    this.currentPage = 1;
    this.hasMore = true;
    const fetchResponse = await lastValueFrom(
      this.studentsService.fetch({
        limit: this.pageLimit,
        skip: 0,
        customQuery: JSON.stringify({
          $or: [
            { official: true, won: false },
            { official: true, won: true },
            { official: false, won: true },
          ],
        }),
      })
    );
    if (fetchResponse.success) {
      const items: IAccount[] = fetchResponse.data?.items ?? [];
      this.hasMore = items.length === this.pageLimit;
      this.currentPage = 2;
      this.setStudents(items);
    } else {
      this.resetStudents();
    }
    this.isLoading = false;
  }

  public async loadMore(): Promise<void> {
    if (this.isLoadingMore || !this.hasMore) return;
    this.isLoadingMore = true;
    const fetchResponse = await lastValueFrom(
      this.studentsService.fetch({
        limit: this.pageLimit,
        skip: (this.currentPage - 1) * this.pageLimit,
        page: this.currentPage,
        customQuery: JSON.stringify({
          $or: [
            { official: true, won: false },
            { official: true, won: true },
            { official: false, won: true },
          ],
        }),
      })
    );
    this.isLoadingMore = false;
    if (fetchResponse.success) {
      const items: IAccount[] = fetchResponse.data?.items ?? [];
      this.hasMore = items.length === this.pageLimit;
      this.currentPage++;
      this.appendStudents(items);
    }
  }
  public onEdit(id: string): void {
    this.studentInfoDrawer.studentId = id;
    this.studentInfoDrawer.toggle();
  }
  public identify = (index: number, item: IAccount) => {
    return item._id;
  };
  public onAllCandidateChecked(checked: boolean): void {
    console.log("checked", checked);
    this.filteredStudents.map((student) => {
      student.selected = checked;
      return student;
    });
  }
  public onSubmitted(lead: IAccount): void {
    this.ngOnInit();
    // this.students.unshift(lead);
    // this.filteredStudents.unshift(lead);
    // this.loadData()
  }
  public onSmartFilterOutput(students: Array<IAccount>): void {
    if (students !== null) {
      this.setStudents(students);
    } else {
      this.loadData();
    }
  }
  private setStudents(students: Array<IAccount>): void {
    const mapped = students.map((s) => ({ ...s, selected: false }));
    this.students = mapped;
    this.filteredStudents = mapped;
  }
  private appendStudents(students: Array<IAccount>): void {
    const mapped = students.map((s) => ({ ...s, selected: false }));
    this.students = [...this.students, ...mapped];
    this.filteredStudents = [...this.filteredStudents, ...mapped];
  }
  private resetStudents(): void {
    this.students = [];
    this.filteredStudents = [];
  }

  // public onChangeSegmentSelector(index: number): void {
  //   this.segmentIndex = index;
  // }

  public get selectedStudents(): Array<string> {
    return this.students.filter((student) => student.selected).map((student) => student._id) || [];
  }

  public totalOfInDebtClass(classes: Array<IAccountClass>): Array<IAccountClass> {
    return classes ? classes.filter((c) => c.inDebt) : [];
  }

  public createStudentManually(): void {
    this.addStudentManuallyModal.toggle();
    this.addStudentManuallyModal.createStudentFormGroup.get("official").setValue(true);
  }
}
