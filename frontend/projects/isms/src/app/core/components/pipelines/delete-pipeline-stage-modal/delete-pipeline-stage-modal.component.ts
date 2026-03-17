import { JsonPipe, NgFor, NgIf, NgStyle } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Pipeline, PipelineStage } from "@isms-core/interfaces";
import { PipelinesService } from "@isms-core/services";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { lastValueFrom } from "rxjs";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzTagModule } from "ng-zorro-antd/tag";

@Component({
  selector: "isms-delete-pipeline-stage-modal",
  templateUrl: "./delete-pipeline-stage-modal.component.html",
  imports: [NgIf, NgFor, ReactiveFormsModule, NzModalModule, NzInputModule, NzSelectModule, NzAlertModule, NzCheckboxModule],
})
export class DeletePipelineStageModalComponent {
  @Output("on-submitted") private readonly onSubmitEmitter: EventEmitter<{
    removePipelineStageId: string;
    receiverPipelineStageId: string;
  }> = new EventEmitter<{
    removePipelineStageId: string;
    receiverPipelineStageId: string;
  }>();
  @Input("pipeline") pipeline: Pipeline;

  public stages: Array<PipelineStage> = [];

  public formGroup: FormGroup = new FormGroup({
    pipelineId: new FormControl(null, [Validators.required]),
    removePipelineStageId: new FormControl(null, [Validators.required]),
    removePipelineStageTitle: new FormControl(null, [Validators.required]),
    removePipelineStageColor: new FormControl(null, [Validators.required]),
    removePipelineStageLeads: new FormControl(0, [Validators.required]),

    receiverPipelineStageId: new FormControl(null, [Validators.required]),
    agree: new FormControl(false, [Validators.requiredTrue]),
  });
  public showModal: boolean = false;

  constructor(
    private readonly nzNotificationService: NzNotificationService,
    private readonly pipelineService: PipelinesService
  ) {}

  public toggle(): void {
    this.stages = this.pipeline.sourcingPipeline.stages.filter((stage) => stage.id !== this.formGroup.value.removePipelineStageId);
    this.formGroup.get("receiverPipelineStageId").setValue(this.stages.length > 0 ? this.stages[0].id : null);

    const removePipelineStage = this.pipeline.sourcingPipeline.stages.find((stage) => stage.id === this.formGroup.value.removePipelineStageId);
    if (removePipelineStage.leads.length > 0) {
      this.showModal = !this.showModal;
      this.formGroup.get("removePipelineStageTitle").setValue(removePipelineStage.title);
      this.formGroup.get("removePipelineStageColor").setValue(removePipelineStage.color);
      this.formGroup.get("removePipelineStageLeads").setValue(removePipelineStage.leads.length);
    } else {
      this.onRemoveStage();
    }
  }

  public onSubmit(): void {
    // call transfer
    // const removePipelineStage = this.pipeline.hiringPipeline.stages.find((stage) => stage.id === this.formGroup.value.removePipelineStageId);
    // /* transfer all candidates befoe */
    // lastValueFrom(
    //   this.candidateService.manage({
    //     action: "add-to-pipeline-with-pipeline-stage",
    //     pipeline: {
    //       pipelineIds: [this.formGroup.value.pipelineId],
    //       pipelineStageId: this.formGroup.value.receiverPipelineStageId
    //     },
    //     candidateIds: removePipelineStage.candidates.map((c) => c.id)
    //   })
    // ).then((res) => {
    //   if (res.success) {
    //     // this.nzMessageService.create(res.success ? "success" : "error", "Successfully moved to stage");
    //     // call remove
    //     this.onRemoveStage();
    //   }
    // });
  }

  public async moveLeads(): Promise<void> {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.valid) {
      lastValueFrom(this.pipelineService.clone({ title: this.formGroup.value.title, pipelineId: this.formGroup.value.pipelineId })).then((res) => {
        if (res.success) {
          this.toggle();
          this.formGroup.reset();
          this.onSubmitEmitter.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Clone Pipeline", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }

  public onRemoveStage(): void {
    lastValueFrom(
      this.pipelineService.removeStage(
        {
          removePipelineStageId: this.formGroup.value.removePipelineStageId,
          receiverPipelineStageId: this.formGroup.value.receiverPipelineStageId,
        },
        this.formGroup.value.pipelineId,
        this.pipeline.type as "leads" | "task"
      )
    ).then((res) => {
      console.log(res);
      if (res.success) {
        this.showModal = false;
        this.onSubmitEmitter.emit({
          removePipelineStageId: this.formGroup.value.removePipelineStageId,
          receiverPipelineStageId: this.formGroup.value.receiverPipelineStageId,
        });
      }
    });
  }
}
