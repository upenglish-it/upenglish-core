import { DatePipe, NgClass, NgFor, NgIf, NgStyle, SlicePipe } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IAccount, IClassStudent, IClassStudentRecord } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { differenceInCalendarDays } from "date-fns";
import { StudentInfoDrawerComponent } from "../student-info-drawer/student-info-drawer.component";
import { ClassesService, NGRXService, StudentsService } from "@isms-core/services";
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
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { DateTime, Interval } from "luxon";
import { isEmpty } from "lodash";
import { NzIconModule } from "ng-zorro-antd/icon";
import { MarkAttendanceModalComponent } from "../mark-attendance-modal/mark-attendance-modal.component";
import { AccountStore } from "@isms-core/ngrx";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { differenceInDays } from "date-fns";
import { ComposedRRule } from "@isms-core/utils";

@Component({
  selector: "isms-attendance-listing",
  templateUrl: "./attendance-listing.component.html",
  imports: [
    NgClass,
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
    NzSelectModule,
    NzDatePickerModule,
    NzInputNumberModule,
    NzAlertModule,
    NzToolTipModule,
    NzIconModule,
    NgStyle,
    AddStudentManuallyModalComponent,
    ManageStudentFilterComponent,
    ImportStudentFromCSVDrawerComponent,
    StudentInfoDrawerComponent,
    MarkAttendanceModalComponent,
    ProfilePhotoDirective,
    ExportJSONToCSVDirective,
    ReachScrollToBottomDirective,
  ],
})
export class AttendanceListingComponent {
  @ViewChild("markAttendanceModal") markAttendanceModal: MarkAttendanceModalComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  public filterFormGroup: FormGroup = new FormGroup({
    // searchQuery: new FormControl(null),
    // limit: new FormControl(50),
    // skip: new FormControl(0),
    // status: new FormControl("active"),
    // branches: new FormControl([])
    classId: new FormControl(""),
    date: new FormControl(DateTime.now().toJSDate()),
  });
  public classes: Array<any> = [];
  public students: Array<IClassStudent> = [];

  public isLoadingMore = false;
  public hasMore = true;
  private currentPage = 1;
  private readonly pageLimit = 50;

  constructor(
    private readonly studentsService: StudentsService,
    private readonly classesService: ClassesService,
    private readonly ngrxService: NGRXService,
    private readonly accountStore: AccountStore
  ) {
    this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));
  }

  // Initialization flow:
  // 1. Fetch all classes (no pagination)
  // 2. Auto-select the first class (_id at index 0) and set it on the filter form.
  // 3. filterFormGroup.valueChanges fires immediately after classId is set,
  //    which resets pagination state and triggers the first attendanceStudents fetch.
  // 4. On scroll-to-bottom, loadMore() increments the page and appends the next batch.

  public ngOnInit(): void {
    lastValueFrom(this.classesService.fetch()).then((res) => {
      if (res.success) {
        this.classes = res.data ?? [];
        if (this.classes.length > 0) {
          this.filterFormGroup.get("classId").setValue(this.classes[0]._id);
        }
      }
    });

    this.subSink.add(
      this.filterFormGroup.valueChanges.pipe(distinctUntilChanged(), debounceTime(100)).subscribe(() => {
        this.currentPage = 1;
        this.hasMore = true;
        this.students = [];
        this.loadData();
      })
    );
  }

  public loadMore(): void {
    if (this.isLoadingMore || !this.hasMore) return;
    this.isLoadingMore = true;
    this.fetchStudents(true).finally(() => {
      this.isLoadingMore = false;
    });
  }

  public async loadData(): Promise<void> {
    await this.fetchStudents(false);
  }

  private async fetchStudents(append: boolean): Promise<void> {
    const res = await lastValueFrom(
      this.classesService.attendanceStudents({
        classId: this.filterFormGroup.value.classId,
        date: DateTime.fromJSDate(this.filterFormGroup.value.date).toFormat("MM-yyyy"),
        limit: this.pageLimit,
        page: this.currentPage,
        ...(this.accountStore.account.role === "teacher" ? { assignedToTeacher: true } : null),
      })
    );

    if (!res.success) {
      this.hasMore = false;
      return;
    }

    const items: IClassStudent[] = (res.data?.items ?? res.data ?? []).map((student: IClassStudent) => {
      student.selected = false;
      student.records = student.records.map((r) => {
        const date = DateTime.fromObject({ day: r.day, month: r.month, year: r.year });
        r.past1Week = differenceInDays(date.toJSDate(), DateTime.now().toJSDate()) <= -7 && this.accountStore.account.role !== "admin";
        return r;
      });
      return student;
    });

    this.hasMore = items.length === this.pageLimit;
    this.currentPage++;
    this.students = append ? [...this.students, ...items] : items;
  }

  public identify = (index: number, item: IClassStudent) => {
    return item.account._id;
  };

  public onAllCandidateChecked(checked: boolean): void {
    console.log("checked", checked);
    this.students.map((student) => {
      student.selected = checked;
      return student;
    });
  }

  public markSelectedAttendance(): void {
    // this.selectedStudents.forEach((studentId) => {
    const students = this.students.filter((s) => this.selectedStudents.includes(s.account._id));
    // if (student) {

    const day = new Date().getDate();
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    const date = DateTime.fromObject({ day: day, month: month, year: year });

    const week = differenceInDays(date.toJSDate(), DateTime.now().toJSDate());

    this.markAttendance(students, {
      included: false,
      enable: false,
      day: day,
      month: month,
      year: year,
      amount: 0,
      isAbsent: 0,
      past1Week: week <= -7 && this.accountStore.account.role !== "admin",
    } as any);
    //   }
    // });
  }

  public markAttendance(tuitionAttendances: IClassStudent[], record?: IClassStudentRecord): void {
    /* stop execution if not admin and record is pass 1 week */
    console.log("record", tuitionAttendances, record);
    if (record && record.past1Week) {
      return;
    }

    let studentClassId = this.filterFormGroup.value.classId;
    let date = this.filterFormGroup.value.date;
    let studentIds = this.selectedStudents;
    let selectedStudentsWithClass = tuitionAttendances.map((ta) => {
      return {
        studentId: ta.account._id,
        studentTuitionAttendanceId: ta._id,
      };
    });

    // if (tuitionAttendances.length > 0 && record) {
    studentIds = tuitionAttendances.map((ta) => ta.account._id);
    date = DateTime.local(record.year, record.month, record.day).toJSDate();
    // }

    if (record) {
      this.markAttendanceModal.record = record;
    }
    // this.markAttendanceModal.formGroup.get("studentTuitionAttendanceId").setValue(tuitionAttendance._id);
    this.markAttendanceModal.formGroup.get("studentClassId").setValue(studentClassId);
    this.markAttendanceModal.formGroup.get("date").setValue(date);
    this.markAttendanceModal.formGroup.get("offDayRestriction").setValue(false);

    if (record) {
      this.markAttendanceModal.formGroup.get("status").setValue(record && record.status ? record.status : null);
    }

    this.markAttendanceModal.formGroup.get("studentIds").setValue(studentIds);
    this.markAttendanceModal.formGroup.get("studentIdsWithClass").setValue(selectedStudentsWithClass);
    this.markAttendanceModal.loadData();
  }

  public onSmartFilterOutput(students: Array<IAccount>): void {
    if (students !== null) {
      this.setStudents(students);
    } else {
      this.loadData();
    }
  }
  private setStudents(students: Array<IAccount>): void {
    // const mappedStudents = students.map((student) => {
    //   student["selected"] = false;
    //   return student;
    // });
    // this.students = mappedStudents;
    // this.filteredStudents = mappedStudents;
  }
  private resetStudents(): void {
    // this.students = [];
    // this.filteredStudents = [];
  }

  // public onChangeSegmentSelector(index: number): void {
  //   this.segmentIndex = index;
  // }

  public get selectedStudents(): Array<string> {
    return this.students.filter((student) => student.selected).map((student) => student.account._id) || [];
  }

  public get selectedStudentsWithClass(): Array<{ studentId: string; studentTuitionAttendanceId: string }> {
    return (
      this.students
        .filter((student) => student.selected)
        .map((student) => {
          return {
            studentId: student.account._id,
            studentTuitionAttendanceId: student._id,
          };
        }) || []
    );
  }

  public disabledPreviousDate = (current: Date): boolean => differenceInCalendarDays(current, new Date()) < 0;
}
