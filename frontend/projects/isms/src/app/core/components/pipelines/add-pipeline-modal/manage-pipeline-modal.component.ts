import { NgIf } from "@angular/common";
import { Component, EventEmitter, Output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { PipelinesService } from "@isms-core/services/src/pipelines";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzSelectModule } from "ng-zorro-antd/select";
import { lastValueFrom } from "rxjs";

@Component({
  selector: "isms-add-pipeline-modal",
  templateUrl: "./add-pipeline-modal.component.html",
  imports: [NgIf, ReactiveFormsModule, NzModalModule, NzInputModule, NzSelectModule],
})
export class AddNewPipelineModalComponent {
  public formGroup: FormGroup = new FormGroup({
    title: new FormControl(null, [Validators.required]),
    type: new FormControl<"leads" | "task">("leads", [Validators.required]),
  });
  @Output("on-submitted") private onSubmitEmitter: EventEmitter<void> = new EventEmitter<void>();
  public showModal: boolean = false;

  constructor(
    private readonly router: Router,
    private readonly pipelinesService: PipelinesService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public toggle(): void {
    this.showModal = !this.showModal;
  }

  public async onSubmit(): Promise<void> {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.valid) {
      lastValueFrom(this.pipelinesService.create({ title: this.formGroup.value.title, type: this.formGroup.value.type })).then((res) => {
        if (res.success) {
          this.toggle();
          this.formGroup.reset();
          this.onSubmitEmitter.emit();
          const type = (res.data && (res.data as any).type) || this.formGroup.value.type;
          this.router.navigateByUrl(`/i/pipelines/designer/settings/${res.data._id}/${type}`);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Add New Pipeline", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }
}
