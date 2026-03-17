import { NgIf } from "@angular/common";
import { Component, EventEmitter, Output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { lastValueFrom } from "rxjs";
import { PipelinesService } from "@isms-core/services/src/pipelines";
import { Pipeline } from "@isms-core/interfaces";

@Component({
  selector: "isms-clone-pipeline-modal",
  templateUrl: "./clone-pipeline-modal.component.html",
  imports: [NgIf, ReactiveFormsModule, NzModalModule, NzInputModule, NzAlertModule],
})
export class ClonePipelineModalComponent {
  @Output("on-submit") private onSubmitEmitter: EventEmitter<Pipeline> = new EventEmitter<Pipeline>();
  public formGroup: FormGroup = new FormGroup({
    title: new FormControl(null, [Validators.required]),
    pipelineId: new FormControl(null, [Validators.required]),
  });
  public showModal: boolean = false;

  constructor(
    private readonly pipelinesService: PipelinesService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public toggle(): void {
    this.showModal = !this.showModal;
  }

  public async onSubmit(): Promise<void> {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.valid) {
      lastValueFrom(this.pipelinesService.clone({ title: this.formGroup.value.title, pipelineId: this.formGroup.value.pipelineId })).then((res) => {
        if (res.success) {
          this.toggle();
          this.formGroup.reset();
          this.onSubmitEmitter.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Clone Pipeline", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }
}
