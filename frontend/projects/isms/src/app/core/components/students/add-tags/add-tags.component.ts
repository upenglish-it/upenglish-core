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
  selector: "isms-add-tags",
  templateUrl: "./add-tags.component.html",
  imports: [NgIf, ReactiveFormsModule, NzModalModule, NzSelectModule, NzButtonModule],
})
export class AddTagsModalComponent implements OnInit, OnDestroy {
  @Input({ required: true, alias: "student-ids" }) studentIds: Array<string>;
  public showModal: boolean = false;
  public loadingSubmitButton: boolean = false;

  public addTagsFormGroup: FormGroup = new FormGroup({
    tags: new FormControl([], [Validators.required, Validators.minLength(1)]),
  });

  constructor(
    private readonly studentService: StudentsService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {}

  public ngOnDestroy(): void {}

  public toggle(): void {
    this.showModal = !this.showModal;
    this.addTagsFormGroup.reset({ tags: [] });
  }

  public onSubmit(): void {
    this.addTagsFormGroup.markAllAsTouched();

    this.loadingSubmitButton = true;

    lastValueFrom(
      this.studentService.addTags({
        studentIds: this.studentIds,
        tags: this.addTagsFormGroup.value.tags,
      })
    ).then((res) => {
      this.loadingSubmitButton = false;
      const notificationTitle = "Add Tags";
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
