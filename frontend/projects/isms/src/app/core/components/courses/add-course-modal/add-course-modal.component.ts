import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ICourse, IMaterial } from "@isms-core/interfaces";
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
import { SubSink } from "subsink";
import { lastValueFrom } from "rxjs";
import { CourseFormGroup } from "@isms-core/form-group";
import { ParserVND, FormatterVND } from "@isms-core/utils";
import { CoursesService } from "@isms-core/services/src/courses";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { MaterialsService } from "@isms-core/services";

@Component({
  selector: "isms-add-course-modal",
  templateUrl: "./add-course-modal.component.html",
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    NzDrawerModule,
    NzModalModule,
    NzButtonModule,
    NzInputNumberModule,
    NzInputModule,
    NzTagModule,
    NzSelectModule,
    NzIconModule,
    NzToolTipModule,
    NzDatePickerModule,
  ],
})
export class AddCourseModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") onSubmitted: EventEmitter<ICourse> = new EventEmitter();
  public courseFormGroup: FormGroup = CourseFormGroup();
  private subSink: SubSink = new SubSink();
  public formatterVND = FormatterVND;
  public parserVND = ParserVND;
  public loading: boolean = false;
  public showModal: boolean = false;
  public courseId: string = null;
  public materials: Array<IMaterial> = [];

  constructor(
    private readonly coursesService: CoursesService,
    private readonly materialsService: MaterialsService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {
    lastValueFrom(this.materialsService.fetch({ limit: 100 })).then((res) => {
      this.materials = res.success ? res.data : [];
    });
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  public toggle(): void {
    this.courseFormGroup.reset({ _id: null, name: null, price: 0, hourlyMonthlyPrice: 0, hourlyPackagePrice: 0, material: null });
    this.showModal = !this.showModal;
    if (this.showModal && this.courseId) {
      this.loadData();
    }
  }

  private loadData(): void {
    this.loading = true;
    lastValueFrom(this.coursesService.fetchById(this.courseId)).then((res) => {
      this.loading = false;
      if (res.success) {
        this.courseFormGroup.get("_id").setValue(res.data._id);
        this.courseFormGroup.get("name").setValue(res.data.name);
        this.courseFormGroup.get("price").setValue(res.data.price);
        this.courseFormGroup.get("material").setValue(res.data.material);
        this.courseFormGroup.get("hourlyMonthlyPrice").setValue(res.data.hourlyMonthlyPrice || 0);
        this.courseFormGroup.get("hourlyPackagePrice").setValue(res.data.hourlyPackagePrice || 0);
      }
    });
  }

  public onCreate(): void {
    this.courseFormGroup.markAllAsTouched();
    this.loading = true;
    console.log("this.personalInfoFormGroup", this.courseFormGroup.value);

    lastValueFrom(this.coursesService.create(this.courseFormGroup.value)).then((res) => {
      this.loading = false;
      if (res.success) {
        this.toggle();
        this.showModal = false;
        this.onSubmitted.emit(res.data);
      }
      this.nzNotificationService.create(res.success ? "success" : "error", "Create Course", res.message, { nzPlacement: "bottomRight" });
    });
  }

  public onUpdate(): void {
    this.courseFormGroup.markAllAsTouched();

    this.loading = true;

    console.log("this.personalInfoFormGroup", this.courseFormGroup.value);

    lastValueFrom(
      this.coursesService.updateById(
        {
          name: this.courseFormGroup.value.name,
          price: this.courseFormGroup.value.price,
          material: this.courseFormGroup.value.material,
          hourlyMonthlyPrice: parseInt(this.courseFormGroup.value.hourlyMonthlyPrice) || 0,
          hourlyPackagePrice: parseInt(this.courseFormGroup.value.hourlyPackagePrice) || 0,
        },
        this.courseFormGroup.value._id
      )
    ).then((res) => {
      this.loading = false;
      if (res.success) {
        this.toggle();
        this.showModal = false;
        this.onSubmitted.emit(res.data);
      }
      this.nzNotificationService.create(res.success ? "success" : "error", "Update Course", res.message, { nzPlacement: "bottomRight" });
    });
  }
}
