import { NgIf } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { PipelinesNotesService } from "@isms-core/services/src/pipelines";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzStepsModule } from "ng-zorro-antd/steps";
import { NzDescriptionsModule } from "ng-zorro-antd/descriptions";
import { lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzBadgeModule } from "ng-zorro-antd/badge";

@Component({
  selector: "isms-add-note-modal",
  templateUrl: "./add-note-modal.component.html",
  imports: [NgIf, ReactiveFormsModule, NzModalModule, NzInputModule, NzButtonModule, NzIconModule, NzTagModule, NzDescriptionsModule, NzStepsModule, NzBadgeModule, NzIconModule],
})
export class AddNoteModalComponent {
  public formGroup: FormGroup = new FormGroup({
    leadIds: new FormControl(null, [Validators.required]),
    pipelineId: new FormControl(null, [Validators.required]),
    pipelineStageId: new FormControl(null, [Validators.required]),
    title: new FormControl(null, [Validators.required]),
    message: new FormControl(null, [Validators.required]),
  });

  @Input("hide-cancel") hideCancel: boolean = false;
  @Output("on-submitted")
  private onSubmittedEmitter: EventEmitter<void> = new EventEmitter<void>();

  public showModal: boolean = false;

  constructor(
    private readonly pipelinesNotesService: PipelinesNotesService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public toggle(): void {
    this.showModal = !this.showModal;
  }

  public async onSubmit(): Promise<void> {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.valid) {
      lastValueFrom(
        this.pipelinesNotesService.create(this.formGroup.value.pipelineId, {
          leadIds: this.formGroup.value.leadIds,
          title: this.formGroup.value.title,
          message: this.formGroup.value.message,
        })
      ).then((res) => {
        if (res.success) {
          this.toggle();
          this.onSubmittedEmitter.emit();
          this.formGroup.reset();
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Add Note", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }
}
