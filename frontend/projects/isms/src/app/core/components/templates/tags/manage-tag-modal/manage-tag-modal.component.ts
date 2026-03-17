import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ICourse, INameValue } from "@isms-core/interfaces";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NgFor, NgIf } from "@angular/common";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { lastValueFrom } from "rxjs";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { SubSink } from "subsink";
import { TagFormGroup } from "@isms-core/form-group";
import { TemplatesTagService } from "@isms-core/services";
import { NzTimePickerModule } from "ng-zorro-antd/time-picker";
import { NzColorPickerModule } from "ng-zorro-antd/color-picker";

@Component({
  selector: "isms-manage-tag-modal",
  templateUrl: "./manage-tag-modal.component.html",
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    NzDrawerModule,
    NzModalModule,
    NzButtonModule,
    NzInputModule,
    NzIconModule,
    NzToolTipModule,
    NzSelectModule,
    NzColorPickerModule,
    NzTimePickerModule,
  ],
})
export class ManageTagModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") onSubmitted: EventEmitter<ICourse> = new EventEmitter();
  public tagFormGroup: FormGroup = TagFormGroup();
  private subSink: SubSink = new SubSink();
  public loading: boolean = false;
  public showModal: boolean = false;
  public tagId: string = null;
  public types: INameValue[] = [
    { name: "General", value: "general" },
    { name: "Relationship", value: "relationship" },
    { name: "Pipeline", value: "pipeline" },
  ];

  constructor(
    private readonly templatesTagService: TemplatesTagService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {}

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  private loadData(): void {
    this.loading = true;
    lastValueFrom(this.templatesTagService.fetchById(this.tagId)).then((res) => {
      this.loading = false;
      if (res.success) {
        this.tagFormGroup.get("_id").setValue(res.data._id);
        this.tagFormGroup.get("value").setValue(res.data.value);
        this.tagFormGroup.get("color").setValue(res.data.color);
      }
    });
  }

  public toggle(): void {
    this.showModal = !this.showModal;
    this.tagFormGroup.reset({ _id: this.tagId });
    if (this.showModal && this.tagId) {
      this.loadData();
    }
  }

  public onCreate(): void {
    this.tagFormGroup.markAllAsTouched();
    if (this.tagFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.templatesTagService.create({
          value: this.tagFormGroup.value.value,
          color: this.tagFormGroup.value.color,
          type: this.tagFormGroup.value.type,
        })
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Create Tag", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }

  public onUpdate(): void {
    this.tagFormGroup.markAllAsTouched();
    if (this.tagFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.templatesTagService.updateById(
          {
            value: this.tagFormGroup.value.value,
            color: this.tagFormGroup.value.color,
            type: this.tagFormGroup.value.type,
          },
          this.tagFormGroup.value._id
        )
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Update Tag", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }
}
