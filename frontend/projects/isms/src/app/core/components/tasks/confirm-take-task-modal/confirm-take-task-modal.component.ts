import { Component, EventEmitter, Input, OnInit, Output, inject } from "@angular/core";
import { FormArray, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ICourse, Task } from "@isms-core/interfaces";
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
import { SetTaskFormGroup, TaskFormGroup } from "@isms-core/form-group";
import { TasksService } from "@isms-core/services";
import { ActivatedRoute, Router } from "@angular/router";
import { NzTagModule } from "ng-zorro-antd/tag";
import { sample, shuffle } from "lodash";

@Component({
  selector: "isms-confirm-take-task-modal",
  templateUrl: "./confirm-take-task-modal.component.html",
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
    NzTagModule,

    NzTimePickerModule,
  ],
})
export class ConfirmTakeTaskModalComponent implements OnInit {
  @Output("on-generated") onGenerated: EventEmitter<Task> = new EventEmitter();

  public task: Task = null;
  public taskInstances: { instances: number } = null;
  public generatedTask: Task = null;
  // public taskFormGroup: FormGroup = TaskFormGroup();

  public showModal: boolean = true;
  public readonly taskMaxTaken: number = 2;

  private readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  constructor(private readonly tasksService: TasksService) {}

  public ngOnInit(): void {
    const urlCode = this.activatedRoute.snapshot.paramMap.get("id");
    lastValueFrom(this.tasksService.fetchById(urlCode)).then((res) => {
      lastValueFrom(this.tasksService.fetchParticipantInstance(res.data._id))
        .then((participantInstanceRes) => {
          this.taskInstances = participantInstanceRes.success ? participantInstanceRes.data : null;
        })
        .finally(() => {
          this.task = res.success ? res.data : [];
          this.generatedTask = this.task;
        });
    });
  }

  public toggle(): void {
    this.showModal = !this.showModal;
  }

  public generateTask(): void {
    const task = this.generatedTask;
    task.categories = task.categories.map((category) => {
      const questions = category.questions;
      const question = sample(shuffle(questions));
      category.questions = [question];
      return category;
    });
    this.onGenerated.emit({
      _id: task._id,
      generalInfo: task.generalInfo,
      assignee: task.assignee,
      class: task.class,
      categories: task.categories,
      type: this.activatedRoute.snapshot.queryParamMap.get("type"),
      createdBy: task.createdBy._id,
    } as any);
  }

  public close(): void {
    window.close();
  }

  public get totalPoints(): number {
    return this.task.categories.reduce((pv: any, cv: any) => pv + cv.points, 0);
  }
}
