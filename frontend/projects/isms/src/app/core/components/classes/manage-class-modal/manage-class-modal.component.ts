import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ICourse } from "@isms-core/interfaces";
import { NzModalModule } from "ng-zorro-antd/modal";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzButtonModule } from "ng-zorro-antd/button";
import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NumberOnlyDirective } from "@isms-core/directives";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { lastValueFrom } from "rxjs";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { SubSink } from "subsink";
import { ClassFormGroup } from "@isms-core/form-group";
import { CoursesService } from "@isms-core/services/src/courses";
import { ClassesService } from "@isms-core/services";
import { isEmpty } from "lodash";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { AccountStore } from "@isms-core/ngrx";

@Component({
  selector: "isms-manage-class-modal",
  templateUrl: "./manage-class-modal.component.html",
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
    NzRadioModule,
    NzIconModule,
    NzToolTipModule,
    NzDatePickerModule,
  ],
})
export class ManageClassModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") onSubmitted: EventEmitter<ICourse> = new EventEmitter();
  public classFormGroup: FormGroup = ClassFormGroup();
  private subSink: SubSink = new SubSink();
  public loading: boolean = false;
  public showModal: boolean = false;
  public classId: string = null;
  public courses: Array<ICourse> = [];

  constructor(
    private readonly coursesService: CoursesService,
    private readonly classesService: ClassesService,
    private readonly nzNotificationService: NzNotificationService,
    public readonly account: AccountStore
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
    this.loading = true;
    lastValueFrom(this.classesService.fetchById(this.classId)).then((res) => {
      this.loading = false;
      if (res.success) {
        this.classFormGroup.get("_id").setValue(res.data._id);
        this.classFormGroup.get("name").setValue(res.data.name);
        this.classFormGroup.get("course").setValue(res.data.courses);
        this.classFormGroup.get("typeOfRate").setValue(res.data.typeOfRate);
      }
    });
  }

  public toggle(classId: string): void {
    this.showModal = !this.showModal;
    this.classId = classId;
    this.classFormGroup.reset();
    if (this.showModal && !isEmpty(this.classId)) {
      this.loadData();
    }
  }

  public onCreate(): void {
    this.classFormGroup.markAllAsTouched();
    if (this.classFormGroup.valid) {
      this.loading = true;
      lastValueFrom(this.classesService.create(this.classFormGroup.value)).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle(null);
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Create Class", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }

  public onUpdate(): void {
    this.classFormGroup.markAllAsTouched();
    if (this.classFormGroup.valid) {
      this.loading = true;
      lastValueFrom(this.classesService.updateById({ course: this.classFormGroup.value.course, name: this.classFormGroup.value.name }, this.classFormGroup.value._id)).then(
        (res) => {
          this.loading = false;
          if (res.success) {
            this.toggle(null);
            this.showModal = false;
            this.onSubmitted.emit(res.data);
          }
          this.nzNotificationService.create(res.success ? "success" : "error", "Update Class", res.message, { nzPlacement: "bottomRight" });
        }
      );
    }
  }
}
