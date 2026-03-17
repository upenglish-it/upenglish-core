import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ICourse } from "@isms-core/interfaces";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NgFor, NgIf } from "@angular/common";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { lastValueFrom } from "rxjs";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { SubSink } from "subsink";
import { ClassDayFormGroup } from "@isms-core/form-group";
import { ClassesDaysService } from "@isms-core/services";
import { NzTimePickerModule } from "ng-zorro-antd/time-picker";
import { Days } from "@isms-core/constants";

@Component({
  selector: "isms-manage-day-modal",
  templateUrl: "./manage-day-modal.component.html",
  imports: [
    NgIf,
    NgFor,
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
export class ManageDayModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") onSubmitted: EventEmitter<ICourse> = new EventEmitter();
  public classDayFormGroup: FormGroup = ClassDayFormGroup();
  private subSink: SubSink = new SubSink();
  public loading: boolean = false;
  public showModal: boolean = false;
  public dayId: string = null;
  public days = Days;

  constructor(
    private readonly classesDaysService: ClassesDaysService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {}

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  private loadData(): void {
    this.loading = true;
    lastValueFrom(this.classesDaysService.fetchById(this.dayId)).then((res) => {
      this.loading = false;
      if (res.success) {
        this.classDayFormGroup.get("_id").setValue(res.data._id);
        this.classDayFormGroup.get("name").setValue(res.data.name);
        this.classDayFormGroup.get("days").setValue(res.data.days);
      }
    });
  }

  public toggle(): void {
    this.showModal = !this.showModal;
    this.classDayFormGroup.reset();
    if (this.showModal && this.dayId) {
      this.loadData();
    }
  }

  public onCreate(): void {
    this.classDayFormGroup.markAllAsTouched();
    if (this.classDayFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.classesDaysService.create({
          name: this.classDayFormGroup.value.name,
          days: this.classDayFormGroup.value.days,
        })
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Create Day", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }

  public onUpdate(): void {
    this.classDayFormGroup.markAllAsTouched();
    if (this.classDayFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.classesDaysService.updateById(
          {
            name: this.classDayFormGroup.value.name,
            days: this.classDayFormGroup.value.days,
          },
          this.classDayFormGroup.value._id
        )
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Update Day", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }
}
