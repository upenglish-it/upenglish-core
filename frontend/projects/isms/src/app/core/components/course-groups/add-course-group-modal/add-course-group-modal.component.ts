import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ICourse } from "@isms-core/interfaces";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NgFor, NgIf } from "@angular/common";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { lastValueFrom } from "rxjs";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { SubSink } from "subsink";
import { CoursesService, CourseGroupsService } from "@isms-core/services";
import { CourseGroupFormGroup } from "@isms-core/form-group/src/course-group.formgroup";

@Component({
  selector: "isms-add-course-group-modal",
  templateUrl: "./add-course-group-modal.component.html",
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    NzDrawerModule,
    NzModalModule,
    NzButtonModule,
    NzInputModule,
    NzTagModule,
    NzSelectModule,
    NzIconModule,
    NzToolTipModule,
    NzDatePickerModule,
  ],
})
export class AddCourseGroupModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") onSubmitted: EventEmitter<ICourse> = new EventEmitter();
  public courseGroupFormGroup: FormGroup = CourseGroupFormGroup();
  private subSink: SubSink = new SubSink();
  public loading: boolean = false;
  public showModal: boolean = false;
  public courseGroupId: string = null;
  public courses: Array<ICourse> = [];

  constructor(
    private readonly coursesService: CoursesService,
    private readonly courseGroupsService: CourseGroupsService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {
    lastValueFrom(this.coursesService.fetch()).then((res) => {
      this.courses = res.success ? res.data : [];
    });
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  private loadData(): void {
    lastValueFrom(this.courseGroupsService.fetchById(this.courseGroupId)).then((res) => {
      if (res.success) {
        this.courseGroupFormGroup.get("_id").setValue(res.data._id);
        this.courseGroupFormGroup.get("name").setValue(res.data.name);
        this.courseGroupFormGroup.get("courses").setValue(res.data.courses);
      }
    });
  }

  public toggle(): void {
    this.showModal = !this.showModal;
    this.courseGroupFormGroup.reset({
      ...{ courses: [] },
    });
    if (this.showModal && this.courseGroupId) {
      this.loadData();
    }
  }

  public onCreate(): void {
    this.courseGroupFormGroup.markAllAsTouched();
    if (this.courseGroupFormGroup.valid) {
      this.loading = true;
      lastValueFrom(this.courseGroupsService.create(this.courseGroupFormGroup.value)).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Create Course Group", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }

  public onUpdate(): void {
    this.courseGroupFormGroup.markAllAsTouched();
    if (this.courseGroupFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.courseGroupsService.updateById({ name: this.courseGroupFormGroup.value.name, courses: this.courseGroupFormGroup.value.courses }, this.courseGroupFormGroup.value._id)
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Update Course Group", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }
}
