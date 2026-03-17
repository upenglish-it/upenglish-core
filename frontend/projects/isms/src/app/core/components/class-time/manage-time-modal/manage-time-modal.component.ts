import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ICourse } from "@isms-core/interfaces";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NgIf } from "@angular/common";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { lastValueFrom } from "rxjs";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { SubSink } from "subsink";
import { ClassTimeFormGroup } from "@isms-core/form-group";
import { ClassesTimeService } from "@isms-core/services";
import { NzTimePickerModule } from "ng-zorro-antd/time-picker";
import { DateTime } from "luxon";

@Component({
  selector: "isms-manage-time-modal",
  templateUrl: "./manage-time-modal.component.html",
  imports: [
    NgIf,
    ReactiveFormsModule,
    NzDrawerModule,
    NzModalModule,
    NzButtonModule,
    NzInputModule,
    NzTagModule,
    NzSelectModule,
    NzIconModule,
    NzToolTipModule,
    NzDatePickerModule,
    NzTimePickerModule,
  ],
})
export class ManageTimeModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") onSubmitted: EventEmitter<ICourse> = new EventEmitter();
  public classTimeFormGroup: FormGroup = ClassTimeFormGroup();
  private subSink: SubSink = new SubSink();
  public loading: boolean = false;
  public showModal: boolean = false;
  public timeId: string = null;

  constructor(
    private readonly classesTimeService: ClassesTimeService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {}

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  private loadData(): void {
    this.loading = true;
    lastValueFrom(this.classesTimeService.fetchById(this.timeId)).then((res) => {
      this.loading = false;
      if (res.success) {
        this.classTimeFormGroup.get("_id").setValue(res.data._id);
        this.classTimeFormGroup.get("name").setValue(res.data.name);
        this.classTimeFormGroup.get("from").setValue(DateTime.fromISO(res.data.from).toJSDate());
        this.classTimeFormGroup.get("to").setValue(DateTime.fromISO(res.data.to).toJSDate());
      }
    });
  }

  public toggle(): void {
    this.showModal = !this.showModal;
    this.classTimeFormGroup.reset();
    if (this.showModal && this.timeId) {
      this.loadData();
    }
  }

  public onCreate(): void {
    this.classTimeFormGroup.markAllAsTouched();
    if (this.classTimeFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.classesTimeService.create({
          name: this.classTimeFormGroup.value.name,
          from: DateTime.fromJSDate(this.classTimeFormGroup.value.from).toFormat("hh:mm"),
          to: DateTime.fromJSDate(this.classTimeFormGroup.value.to).toFormat("hh:mm"),
        })
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Create Time", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }

  public onUpdate(): void {
    this.classTimeFormGroup.markAllAsTouched();
    if (this.classTimeFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.classesTimeService.updateById(
          {
            name: this.classTimeFormGroup.value.name,
            from: DateTime.fromJSDate(this.classTimeFormGroup.value.from).toFormat("hh:mm"),
            to: DateTime.fromJSDate(this.classTimeFormGroup.value.to).toFormat("hh:mm"),
          },
          this.classTimeFormGroup.value._id
        )
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Update Time", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }
}
