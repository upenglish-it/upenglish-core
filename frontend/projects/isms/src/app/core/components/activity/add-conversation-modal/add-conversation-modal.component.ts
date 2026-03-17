import { NgIf } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { PipelinesConversationsService } from "@isms-core/services/src/pipelines";
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
  selector: "isms-add-conversation-modal",
  templateUrl: "./add-conversation-modal.component.html",
  imports: [
    NgIf,
    ReactiveFormsModule,
    NzModalModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
    NzTagModule,
    NzDescriptionsModule,
    NzStepsModule,
    NzBadgeModule,
    NzIconModule,
  ],
})
export class AddConversationModalComponent {
  @Input({ alias: "type", required: true }) public type: "modal" | "inline";
  public readonly formGroup: FormGroup = new FormGroup({
    leadId: new FormControl(null, [Validators.required]),
    pipelineId: new FormControl(null, [Validators.required]),
    pipelineStageId: new FormControl(null, [Validators.required]),
    message: new FormControl(null, [Validators.required]),
  });
  @Output("on-submitted") private readonly onSubmittedEmitter: EventEmitter<void> = new EventEmitter<void>();

  public showModal: boolean = false;

  constructor(
    private readonly pipelinesConversationsService: PipelinesConversationsService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public toggle(): void {
    this.showModal = !this.showModal;
  }

  public async onSubmit(): Promise<void> {
    console.log(this.formGroup);
    this.formGroup.markAllAsTouched();
    if (this.formGroup.valid) {
      lastValueFrom(
        this.pipelinesConversationsService.create(this.formGroup.value.pipelineId, {
          leadId: this.formGroup.value.leadId,
          message: this.formGroup.value.message,
        })
      ).then((res) => {
        if (res.success) {
          this.onSubmittedEmitter.emit();
          this.formGroup.get("message").reset();
          if (this.type === "modal") {
            this.toggle();
            this.formGroup.reset();
          }
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Add Conversation", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }
}
