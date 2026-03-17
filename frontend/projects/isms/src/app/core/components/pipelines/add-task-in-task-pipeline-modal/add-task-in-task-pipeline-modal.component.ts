import { Component, EventEmitter, Output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { PipelinesService } from "@isms-core/services/src/pipelines";
import { lastValueFrom } from "rxjs";

@Component({
  selector: "isms-add-task-in-task-pipeline-modal",
  templateUrl: "./add-task-in-task-pipeline-modal.component.html",
  imports: [ReactiveFormsModule, NzModalModule, NzInputModule, NzButtonModule],
})
export class AddTaskInTaskPipelineModalComponent {
  @Output("on-submitted") public readonly onSubmittedEmitter: EventEmitter<void> = new EventEmitter<void>();

  public formGroup: FormGroup = new FormGroup({
    pipelineId: new FormControl<string | null>(null, [Validators.required]),
    pipelineStageId: new FormControl<string | null>(null, [Validators.required]),
    taskId: new FormControl<string | null>(null),
    name: new FormControl<string | null>(null, [Validators.required]),
    notes: new FormControl<string | null>(null),
  });

  public showModal = false;

  constructor(
    private readonly pipelinesService: PipelinesService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public open(pipelineId: string, pipelineStageId: string): void {
    this.formGroup.reset({
      pipelineId,
      pipelineStageId,
      taskId: null,
      name: null,
      notes: null,
    });
    this.showModal = true;
  }

  public openForEdit(
    pipelineId: string,
    pipelineStageId: string,
    task: { taskId?: string; name?: string; notes?: string | null }
  ): void {
    this.formGroup.reset({
      pipelineId,
      pipelineStageId,
      taskId: task.taskId ?? null,
      name: task.name ?? null,
      notes: task.notes ?? null,
    });
    this.showModal = true;
  }

  public async onSubmit(): Promise<void> {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const { pipelineId, pipelineStageId, taskId, name, notes } = this.formGroup.value;
    const isEdit = !!taskId;

    const stagesIds: { taskId?: string; currentStageId: string } = {
      currentStageId: pipelineStageId as string,
    };
    if (isEdit) {
      stagesIds.taskId = taskId as string;
    }

    lastValueFrom(
      this.pipelinesService.manageTaskInTaskPipeline(pipelineId as string, {
        stagesIds,
        action: isEdit ? "edit" : "add",
        name: name as string,
        notes: notes ?? null,
      })
    ).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", isEdit ? "Edit Task" : "Add Task", res.message, {
        nzPlacement: "bottomRight",
      });

      if (res.success) {
        this.showModal = false;
        this.onSubmittedEmitter.emit();
      }
    });
  }
}
