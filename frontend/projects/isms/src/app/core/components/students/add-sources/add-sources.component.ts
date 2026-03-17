import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { NgIf } from "@angular/common";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzSelectModule } from "ng-zorro-antd/select";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { NzButtonModule } from "ng-zorro-antd/button";
import { lastValueFrom } from "rxjs";
import { StudentsService } from "@isms-core/services";
import { NzNotificationService } from "ng-zorro-antd/notification";

@Component({
  selector: "isms-add-sources",
  templateUrl: "./add-sources.component.html",
  imports: [NgIf, ReactiveFormsModule, NzModalModule, NzSelectModule, NzButtonModule],
})
export class AddSourcesModalComponent implements OnInit, OnDestroy {
  @Input("student-ids") studentIds: Array<string>;
  public showModal: boolean = false;
  public loadingSubmitButton: boolean = false;

  public addSourcesFormGroup: FormGroup = new FormGroup({
    sources: new FormControl([], [Validators.required, Validators.minLength(1)]),
  });

  constructor(
    private readonly studentService: StudentsService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {}

  public ngOnDestroy(): void {}

  public toggle(): void {
    this.showModal = !this.showModal;
    this.addSourcesFormGroup.reset({ sources: [] });
  }

  public onSubmit(): void {
    this.addSourcesFormGroup.markAllAsTouched();

    this.loadingSubmitButton = true;

    lastValueFrom(
      this.studentService.addSources({
        studentIds: this.studentIds,
        sources: this.addSourcesFormGroup.value.sources,
      })
    ).then((res) => {
      this.loadingSubmitButton = false;
      const notificationTitle = "Add Sources";
      if (res.success) {
        this.showModal = false;
        this.nzNotificationService.success(notificationTitle, res.message, {
          nzPlacement: "bottomRight",
        });
      } else {
        this.nzNotificationService.error(notificationTitle, res.message, {
          nzPlacement: "bottomRight",
        });
      }
    });
  }
}
