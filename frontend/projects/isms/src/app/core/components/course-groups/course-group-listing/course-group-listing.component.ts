import { DatePipe, NgFor } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { ICourseGroup } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { CourseGroupsService, NGRXService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { AddCourseGroupModalComponent } from "../add-course-group-modal/add-course-group-modal.component";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";

@Component({
  selector: "isms-course-group-listing",
  templateUrl: "./course-group-listing.component.html",
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
    AddCourseGroupModalComponent,
  ],
})
export class CourseGroupListingComponent {
  @ViewChild("addCourseGroupModal") addCourseGroupModal: AddCourseGroupModalComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  private courseGroups: Array<ICourseGroup> = [];
  public filteredCourseGroups: Array<ICourseGroup> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });

  constructor(
    private readonly courseGroupsService: CourseGroupsService,
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
          this.filteredCourseGroups = this.find(this.courseGroups, value);
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
    lastValueFrom(this.courseGroupsService.fetch({ limit: 100 })).then((res) => {
      if (res.success) {
        this.setStudents(res.data);
      } else {
        this.resetStudents();
      }
    });
  }

  public onEdit(id: string): void {
    this.addCourseGroupModal.courseGroupId = id;
    this.addCourseGroupModal.toggle();
  }

  public onDelete(id: string): void {
    lastValueFrom(this.courseGroupsService.delete(id)).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Delete Course", res.message, { nzPlacement: "bottomRight" });
      this.loadData();
    });
  }

  public identify = (index: number, item: ICourseGroup) => {
    return item._id;
  };

  public onSubmitted(course: ICourseGroup): void {
    this.courseGroups.unshift(course);
    this.filteredCourseGroups.unshift(course);
  }

  private setStudents(courseGroups: Array<ICourseGroup>): void {
    const mapped = courseGroups.map((course) => {
      return course;
    });
    this.courseGroups = mapped;
    this.filteredCourseGroups = mapped;
  }

  private resetStudents(): void {
    this.courseGroups = [];
    this.filteredCourseGroups = [];
  }
}
