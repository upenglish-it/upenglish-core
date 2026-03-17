import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NgxTinymceModule } from "ngx-tinymce";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { IClass, ICourse, Task } from "@isms-core/interfaces";
import { lastValueFrom } from "rxjs";
import { ClassesService, CoursesService } from "@isms-core/services";

@Component({
  selector: "isms-task-general-info",
  templateUrl: "./task-general-info.component.html",
  imports: [NgIf, NgFor, ReactiveFormsModule, NzSelectModule, NzInputModule, NzInputNumberModule, NzDatePickerModule, NzSwitchModule, NzToolTipModule, NgxTinymceModule],
})
export class TaskGeneralInfoComponent implements OnInit {
  @Input("form-group") formGroup: FormGroup;
  @Input("task") task: Task;
  public courses: Array<ICourse> = [];
  public classes: Array<IClass> = [];

  constructor(
    private readonly coursesService: CoursesService,
    private readonly classesService: ClassesService
  ) {}

  public ngOnInit(): void {
    lastValueFrom(this.coursesService.fetch({ limit: 100 })).then((res) => {
      this.courses = res.success ? res.data : [];
    });
    lastValueFrom(this.classesService.fetch({ limit: 100 })).then((res) => {
      this.classes = res.success ? res.data : [];
    });
  }

  public get generalInfoFormGroup(): FormGroup {
    return this.formGroup.get("generalInfo") as FormGroup;
  }

  public get durationFormGroup(): FormGroup {
    return this.generalInfoFormGroup.get("duration") as FormGroup;
  }

  public get totalPoints(): number {
    return this.task.categories.reduce((pv: any, cv: any) => pv + cv.points, 0);
  }
}
