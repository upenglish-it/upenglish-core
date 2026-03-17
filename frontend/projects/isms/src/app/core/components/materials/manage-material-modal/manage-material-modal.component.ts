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
import { MaterialFormGroup } from "@isms-core/form-group";
import { MaterialsService } from "@isms-core/services";
import { NzTimePickerModule } from "ng-zorro-antd/time-picker";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";

@Component({
  selector: "isms-manage-material-modal",
  templateUrl: "./manage-material-modal.component.html",
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
    NzInputNumberModule,
  ],
})
export class ManageMaterialModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") onSubmitted: EventEmitter<ICourse> = new EventEmitter();
  public materialFormGroup: FormGroup = MaterialFormGroup();
  private subSink: SubSink = new SubSink();
  public loading: boolean = false;
  public showModal: boolean = false;
  public materialId: string = null;

  constructor(
    private readonly materialsService: MaterialsService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {}

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  private loadData(): void {
    this.loading = true;
    lastValueFrom(this.materialsService.fetchById(this.materialId)).then((res) => {
      this.loading = false;
      if (res.success) {
        this.materialFormGroup.get("_id").setValue(res.data._id);
        this.materialFormGroup.get("name").setValue(res.data.name);
        this.materialFormGroup.get("price").setValue(res.data.price);
        this.materialFormGroup.get("quantity").setValue(res.data.quantity);
      }
    });
  }

  public toggle(): void {
    this.showModal = !this.showModal;
    this.materialFormGroup.reset();
    if (this.showModal && this.materialId) {
      this.loadData();
    }
  }

  public onCreate(): void {
    this.materialFormGroup.markAllAsTouched();
    if (this.materialFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.materialsService.create({
          name: this.materialFormGroup.value.name,
          price: this.materialFormGroup.value.price,
          quantity: this.materialFormGroup.value.quantity,
        })
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Create Material", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }

  public onUpdate(): void {
    this.materialFormGroup.markAllAsTouched();
    if (this.materialFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.materialsService.updateById(
          {
            name: this.materialFormGroup.value.name,
            price: this.materialFormGroup.value.price,
            quantity: this.materialFormGroup.value.quantity,
          },
          this.materialFormGroup.value._id
        )
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Update Material", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }
}
