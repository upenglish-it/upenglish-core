import { Component, EventEmitter, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ICourse } from "@isms-core/interfaces";
import { NzModalModule } from "ng-zorro-antd/modal";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzButtonModule } from "ng-zorro-antd/button";
import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NumberOnlyDirective } from "@isms-core/directives";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { lastValueFrom } from "rxjs";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzTimePickerModule } from "ng-zorro-antd/time-picker";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { TaskFormGroup } from "@isms-core/form-group";
import { TasksService } from "@isms-core/services";
import { ActivatedRoute, Router } from "@angular/router";

@Component({
  selector: "isms-manage-task-modal",
  templateUrl: "./manage-task-modal.component.html",
  imports: [
    NgIf,
    NgFor,
    JsonPipe,
    ReactiveFormsModule,
    SegmentedSelectorComponent,
    NumberOnlyDirective,
    NzDrawerModule,
    NzModalModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzIconModule,
    NzRadioModule,
    NzToolTipModule,
    NzDatePickerModule,

    NzTimePickerModule,
  ],
})
export class ManageTaskModalComponent {
  @Output("on-submitted") onSubmitted: EventEmitter<ICourse> = new EventEmitter();
  public formGroup: FormGroup = TaskFormGroup();
  public loading: boolean = false;
  public showModal: boolean = false;
  public taskTypes = [
    { name: "Challenge", value: "challenge" },
    { name: "Homework", value: "homework" },
  ];

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly tasksService: TasksService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public toggle(): void {
    this.showModal = !this.showModal;
    this.setDefaultValue();
  }

  public onCreate(): void {
    console.log(this.formGroup);
    this.generalInfoFormGroup.markAllAsTouched();
    if (this.generalInfoFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.tasksService.create({
          generalInfo: this.generalInfoFormGroup.value,
        })
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          // redirect
          this.router.navigate([res.data._id, "builder"], { relativeTo: this.activatedRoute });
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Create Task", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }

  private setDefaultValue(): void {
    this.generalInfoFormGroup.get("type").reset("challenge");
    this.generalInfoFormGroup.get("title").reset(null);
  }

  public get generalInfoFormGroup(): FormGroup {
    return this.formGroup.get("generalInfo") as FormGroup;
  }

  public get assigneeFormGroup(): FormGroup {
    return this.formGroup.get("assignee") as FormGroup;
  }
}
