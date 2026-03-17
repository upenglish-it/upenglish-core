import { DatePipe, JsonPipe, NgFor, NgIf, SlicePipe } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { ICourse } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { NGRXService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { ExportJSONToCSVDirective, ProfilePhotoDirective } from "@isms-core/directives";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { StaffInfoDrawerComponent } from "@isms-core/components/staffs/staff-info-drawer/staff-info-drawer.component";
import { AddCourseModalComponent } from "../add-course-modal/add-course-modal.component";
import { CoursesService } from "@isms-core/services/src/courses";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { FormattedCurrencyPipe } from "@isms-core/pipes";
import { NzTableFilterFn, NzTableFilterList, NzTableModule, NzTableSortFn, NzTableSortOrder } from "ng-zorro-antd/table";
import { DateTime } from "luxon";

interface ColumnItem {
  name: string;
  sortOrder: NzTableSortOrder | null;
  sortFn: NzTableSortFn<ICourse> | null;
  listOfFilter: NzTableFilterList;
  filterFn: NzTableFilterFn<ICourse> | null;
  filterMultiple: boolean;
  sortDirections: NzTableSortOrder[];
}

@Component({
  selector: "isms-course-listing",
  templateUrl: "./course-listing.component.html",
  imports: [
    NgIf,
    NgFor,
    JsonPipe,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    SlicePipe,
    NzTagModule,
    NzInputModule,
    NzTableModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDropDownModule,
    NzPopconfirmModule,
    AddCourseModalComponent,
    ProfilePhotoDirective,
    ExportJSONToCSVDirective,
    FormattedCurrencyPipe,
  ],
})
export class CourseListingComponent {
  @ViewChild("addCourseModal") addCourseModal: AddCourseModalComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  private courses: Array<ICourse> = [];
  public filteredCourses: Array<ICourse> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });

  public listOfColumns: ColumnItem[] = [
    {
      name: "ID",
      sortOrder: "ascend",
      sortFn: (a: ICourse, b: ICourse) => a.count - b.count,
      // compare: (a: ICourse, b: ICourse) => a.price - b.price,
      sortDirections: ["descend", "ascend"],
    },
    {
      name: "Name",
      sortOrder: null,
      sortFn: (a: ICourse, b: ICourse) => a.name.localeCompare(b.name),
      sortDirections: ["ascend", "descend", null],
      filterMultiple: true,
      listOfFilter: [
        { text: "Joe", value: "Joe" },
        { text: "Jim", value: "Jim", byDefault: true },
      ],
      filterFn: (list: string[], item: ICourse) => list.some((name) => item.name.indexOf(name) !== -1),
    },
    {
      name: "Price",
      sortOrder: "ascend",
      sortFn: (a: ICourse, b: ICourse) => a.price - b.price,
      // compare: (a: ICourse, b: ICourse) => a.price - b.price,
      sortDirections: ["descend", "ascend"],
    },
    {
      name: "Item",
      // sortOrder: null,
      // sortDirections: ["ascend", "descend", null],
      // sortFn: (a: ItemData, b: ItemData) => a.address.length - b.address.length,
      // filterMultiple: false,
      // listOfFilter: [
      //   { text: "London", value: "London" },
      //   { text: "Sidney", value: "Sidney" }
      // ],
      // filterFn: (address: string, item: ItemData) => item.address.indexOf(address) !== -1
    } as any,
    {
      name: "Created Date",
      sortFn: (a: ICourse, b: ICourse) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime(),
    },
  ];

  constructor(
    private readonly coursesService: CoursesService,
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
          this.filteredCourses = this.find(this.courses, value);
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
    return arr
      .filter((n: { name: string }) => {
        let name = n.name;
        return pa.every((p: { test: (arg0: string) => any }) => p.test(name));
      })
      .map((c, i) => {
        c["count"] = i + 1;
        return c;
      });
  }

  public async loadData(): Promise<void> {
    lastValueFrom(this.coursesService.fetch({ limit: 100 })).then((res) => {
      if (res.success) {
        this.setStudents(res.data);
      } else {
        this.resetStudents();
      }
    });
  }

  public onEdit(id: string): void {
    this.addCourseModal.courseId = id;
    this.addCourseModal.toggle();
  }

  public onDelete(id: string): void {
    lastValueFrom(this.coursesService.delete(id)).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Delete Course", res.message, { nzPlacement: "bottomRight" });
      this.loadData();
    });
  }

  public identify = (index: number, item: ICourse) => {
    return item._id;
  };

  public onSubmitted(course: ICourse): void {
    this.courses.unshift(course);
    this.filteredCourses.unshift(course);
  }

  private setStudents(students: Array<ICourse>): void {
    const mappedStudents = students
      .map((student) => {
        student["selected"] = false;
        return student;
      })
      .map((c, i) => {
        c["count"] = i + 1;
        return c;
      });
    this.courses = mappedStudents;
    this.filteredCourses = mappedStudents;
  }

  private resetStudents(): void {
    this.courses = [];
    this.filteredCourses = [];
  }

  // public onChangeSegmentSelector(index: number): void {
  //   this.segmentIndex = index;
  // }

  public get selectedStudents(): Array<string> {
    return this.courses.filter((course) => course.selected).map((s) => s._id) || [];
  }
}
