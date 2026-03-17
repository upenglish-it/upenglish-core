import { DatePipe, NgFor, NgIf, SlicePipe } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IAccount } from "@isms-core/interfaces";
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
import { ExportJSONToCSVDirective, ProfilePhotoDirective } from "@isms-core/directives";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";

@Component({
  selector: "isms-course-listing",
  templateUrl: "./course-listing.component.html",
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    SlicePipe,
    NzTagModule,
    NzInputModule,
    NzDropDownModule,
    NzButtonModule,
    NzCheckboxModule,
    AddStudentManuallyModalComponent,
    ManageStudentFilterComponent,
    ImportStudentFromCSVDrawerComponent,
    StudentInfoDrawerComponent,
    ProfilePhotoDirective,
    ExportJSONToCSVDirective,
  ],
})
export class StudentListingComponent {
  @ViewChild("studentInfoDrawer") studentInfoDrawer: StudentInfoDrawerComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  private students: Array<IAccount> = [];
  public filteredStudents: Array<IAccount> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });
  // public segmentOptions: Array<ISegmentSelector> = [
  //   {
  //     label: "Students",
  //     description: "Your created students",
  //     icon: "ph-duotone ph-users-four",
  //     disable: false,
  //     type: "students"
  //   },
  //   {
  //     label: "Attendance",
  //     description: "Student attendance",
  //     icon: "ph-duotone ph-list-checks",
  //     disable: false,
  //     type: "tuition-attendance"
  //   },
  //   {
  //     label: "Tuition Payment",
  //     description: "Student pay tuition",
  //     icon: "ph-duotone ph-graduation-cap",
  //     disable: false,
  //     type: "tuition-attendance"
  //   }
  // ];
  // public segmentIndex = 0;
  constructor(
    private readonly studentsService: StudentsService,
    private readonly ngrxService: NGRXService
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
    const fetchResponse = await lastValueFrom(this.studentsService.fetch({ limit: 100 }));
    if (fetchResponse.success) {
      this.setStudents(fetchResponse.data);
    } else {
      this.resetStudents();
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
  public onSubmitted(candidate: IAccount): void {
    this.students.unshift(candidate);
    this.filteredStudents.unshift(candidate);
  }
  public onSmartFilterOutput(students: Array<IAccount>): void {
    if (students !== null) {
      this.setStudents(students);
    } else {
      this.loadData();
    }
  }
  private setStudents(students: Array<IAccount>): void {
    const mappedStudents = students.map((student) => {
      student["selected"] = false;
      return student;
    });
    this.students = mappedStudents;
    this.filteredStudents = mappedStudents;
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
}
