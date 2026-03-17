import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ICourse } from "@isms-core/interfaces";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NgIf } from "@angular/common";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { lastValueFrom } from "rxjs";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { SubSink } from "subsink";
import { SourceFormGroup } from "@isms-core/form-group";
import { TemplatesSourceService } from "@isms-core/services";
import { NzTimePickerModule } from "ng-zorro-antd/time-picker";

@Component({
  selector: "isms-manage-source-modal",
  templateUrl: "./manage-source-modal.component.html",
  imports: [
    NgIf,
    ReactiveFormsModule,
    NzDrawerModule,
    NzModalModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzIconModule,
    NzToolTipModule,
    NzDatePickerModule,
    NzTimePickerModule,
  ],
})
export class ManageSourceModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") onSubmitted: EventEmitter<ICourse> = new EventEmitter();
  public sourceFormGroup: FormGroup = SourceFormGroup();
  private subSink: SubSink = new SubSink();
  public loading: boolean = false;
  public showModal: boolean = false;
  public sourceId: string = null;

  constructor(
    private readonly templatesSourceService: TemplatesSourceService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {}

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  private loadData(): void {
    this.loading = true;
    lastValueFrom(this.templatesSourceService.fetchById(this.sourceId)).then((res) => {
      this.loading = false;
      if (res.success) {
        this.sourceFormGroup.get("_id").setValue(res.data._id);
        this.sourceFormGroup.get("value").setValue(res.data.value);
      }
    });
  }

  public toggle(): void {
    this.showModal = !this.showModal;
    this.sourceFormGroup.reset();
    if (this.showModal && this.sourceId) {
      this.loadData();
    }
  }

  public onCreate(): void {
    this.sourceFormGroup.markAllAsTouched();
    if (this.sourceFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.templatesSourceService.create({
          value: this.sourceFormGroup.value.value,
        })
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Create Source", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }

  public onUpdate(): void {
    this.sourceFormGroup.markAllAsTouched();
    if (this.sourceFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.templatesSourceService.updateById(
          {
            value: this.sourceFormGroup.value.value,
          },
          this.sourceFormGroup.value._id
        )
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Update Source", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }
}
