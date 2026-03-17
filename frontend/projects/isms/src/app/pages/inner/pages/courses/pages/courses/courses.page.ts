import { Component } from "@angular/core";
import { Animations } from "@isms-core/constants";
import { ISegmentSelector } from "@isms-core/interfaces";
import { NgIf } from "@angular/common";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { CourseSegmentOptions } from "./data";
import { CourseListingComponent } from "@isms-core/components/courses/course-listing/course-listing.component";
import { CourseGroupListingComponent } from "@isms-core/components/course-groups/course-group-listing/course-group-listing.component";

@Component({
  templateUrl: "./courses.page.html",
  animations: [Animations.down, Animations.default],
  imports: [
    NgIf,
    // NgFor,
    // FormsModule,
    // ReactiveFormsModule,
    // DatePipe,
    // SlicePipe,
    // RouterModule,
    // NzDropDownModule,
    // NzInputModule,
    // NzButtonModule,
    // NzTableModule,
    // NzCheckboxModule,
    // NzIconModule,
    // NzToolTipModule,
    // NzTagModule,
    // ProfilePhotoDirective,
    SegmentedSelectorComponent,
    // AddStudentManuallyModalComponent,
    // ManageStudentFilterComponent,
    // ImportStudentFromCSVDrawerComponent,
    // StudentInfoDrawerComponent,
    // ReachScrollToBottomDirective,
    // ExportJSONToCSVDirective,
    CourseListingComponent,
    CourseGroupListingComponent,
  ],
})
export class CoursesPage {
  //   @ViewChild("studentInfoDrawer") studentInfoDrawer: StudentInfoDrawerComponent;
  //   private subSink: SubSink = new SubSink();
  //   public selectedBranch: string = null;
  //   private students: Array<IAccount> = [];
  //   public filteredStudents: Array<IAccount> = [];
  //   public filterFormGroup: FormGroup = new FormGroup({
  //     searchQuery: new FormControl(null),
  //     limit: new FormControl(50),
  //     skip: new FormControl(0),
  //     status: new FormControl("active"),
  //     branches: new FormControl([])
  //   });
  public segmentOptions: Array<ISegmentSelector> = CourseSegmentOptions;
  public segmentIndex = 0;
  //   constructor(private readonly studentsService: StudentsService, private readonly ngrxService: NGRXService) {
  //     this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));
  //   }
  //   public ngOnInit(): void {
  //     this.loadData();
  //     this.subSink.add(
  //       this.filterFormGroup
  //         .get("searchQuery")
  //         .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
  //         .subscribe((value) => {
  //           this.filteredStudents = this.find(this.students, value);
  //         })
  //     );
  //   }
  //   /* Temporary search filter. Refactor this later */
  //   private find(arr: any[], pat: string) {
  //     let pa = pat
  //       .trim()
  //       .replace(/ +/g, " ")
  //       .split(" ")
  //       .map((p: string | RegExp) => new RegExp(p, "i"));
  //     return arr.filter((n: { firstName: string; lastName: string }) => {
  //       let name = n.firstName + " " + n.lastName;
  //       return pa.every((p: { test: (arg0: string) => any }) => p.test(name));
  //     });
  //   }
  //   public async loadData(): Promise<void> {
  //     const fetchResponse = await lastValueFrom(this.studentsService.fetch({ limit: 100 }));
  //     if (fetchResponse.success) {
  //       this.setStudents(fetchResponse.data);
  //     } else {
  //       this.resetStudents();
  //     }
  //   }
  //   public onEdit(id: string): void {
  //     this.studentInfoDrawer.studentId = id;
  //     this.studentInfoDrawer.toggle();
  //   }
  //   public identify = (index: number, item: IAccount) => {
  //     return item._id;
  //   };
  //   public onAllCandidateChecked(checked: boolean): void {
  //     console.log("checked", checked);
  //     this.filteredStudents.map((student) => {
  //       student.selected = checked;
  //       return student;
  //     });
  //   }
  //   public onSubmitted(candidate: IAccount): void {
  //     this.students.unshift(candidate);
  //     this.filteredStudents.unshift(candidate);
  //   }
  //   public onSmartFilterOutput(students: Array<IAccount>): void {
  //     if (students !== null) {
  //       this.setStudents(students);
  //     } else {
  //       this.loadData();
  //     }
  //   }
  //   private setStudents(students: Array<IAccount>): void {
  //     const mappedStudents = students.map((student) => {
  //       student["selected"] = false;
  //       return student;
  //     });
  //     this.students = mappedStudents;
  //     this.filteredStudents = mappedStudents;
  //   }
  //   private resetStudents(): void {
  //     this.students = [];
  //     this.filteredStudents = [];
  //   }

  public onChangeSegmentSelector(index: number): void {
    this.segmentIndex = index;
  }

  //   public get selectedStudents(): Array<string> {
  //     return this.students.filter((student) => student.selected).map((student) => student._id) || [];
  //   }
}
