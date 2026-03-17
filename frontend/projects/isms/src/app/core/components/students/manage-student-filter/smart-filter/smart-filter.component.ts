import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { Component, EventEmitter, HostListener, Input, Output } from "@angular/core";
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Animations } from "@isms-core/constants";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzSelectModule } from "ng-zorro-antd/select";
import { FilterItemComponent } from "./filter-item/filter-item.component";
import { lastValueFrom } from "rxjs";
import { SmartFilterStudentsService, StudentsService } from "@isms-core/services";
import { StudentSmartFilterFormGroup } from "@isms-core/form-group";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { ISmartFilterStudent } from "@isms-core/interfaces/src/smart-filters";

@Component({
  selector: "isms-smart-filter",
  templateUrl: "./smart-filter.component.html",
  animations: [Animations.default],
  imports: [NgIf, NgFor, ReactiveFormsModule, JsonPipe, NzDrawerModule, NzButtonModule, NzSelectModule, NzDropDownModule, FilterItemComponent],
})
export class SmartFilterComponent {
  @Output("on-saved") onSaved: EventEmitter<void> = new EventEmitter<void>();
  @Input("smart-filter-id") smartFilterId: string;
  public showDrawer: boolean = false;
  public smartFilterFormGroup: FormGroup = StudentSmartFilterFormGroup();
  public drawerWidth: string = "100%";

  @HostListener("window:resize", [])
  onResize(): void {
    this.updateDrawerWidth();
  }

  constructor(
    private readonly smartFilterStudentsService: SmartFilterStudentsService,
    private readonly nzNotificationService: NzNotificationService
  ) {
    this.updateDrawerWidth();
  }

  private updateDrawerWidth(): void {
    if (typeof window !== "undefined") {
      this.drawerWidth = window.innerWidth < 640 ? "100%" : "580px";
    }
  }

  public toggle(): void {
    this.showDrawer = !this.showDrawer;
    this.filterFormArray.clear();
    this.smartFilterFormGroup.reset();
    if (this.showDrawer && this.smartFilterId) {
      this.loadData();
    }
  }

  private loadData(): void {
    lastValueFrom(this.smartFilterStudentsService.fetchById(this.smartFilterId)).then((res) => {
      if (res.success) {
        const smartFilter: ISmartFilterStudent = res.data;
        this.smartFilterFormGroup.get("_id").setValue(res.data._id);
        this.smartFilterFormGroup.get("title").setValue(res.data.title);
        this.filterFormArray.clear();
        for (const filter of smartFilter.filters) {
          this.filterFormArray.push(
            new FormGroup({
              parameter: new FormControl(filter.parameter, [Validators.required]),
              operator: new FormControl(filter.operator, [Validators.required]),
              value: new FormControl(filter.value, [Validators.required]),
              sequenceOperator: new FormControl(filter.sequenceOperator),
            })
          );
        }
      }
    });
  }

  public onSubmit() {
    if (this.smartFilterFormGroup.value._id) {
      lastValueFrom(
        this.smartFilterStudentsService.update(
          {
            title: this.smartFilterFormGroup.value.title,
            filters: this.smartFilterFormGroup.value.filters,
          },
          this.smartFilterFormGroup.value._id
        )
      ).then((res) => {
        if (res.success) {
          this.nzNotificationService.success("Smart Filter", res.message);
          this.onSaved.emit();
        } else {
          this.nzNotificationService.error("Smart Filter", res.message);
        }
      });
    } else {
      lastValueFrom(
        this.smartFilterStudentsService.create({
          title: this.smartFilterFormGroup.value.title,
          filters: this.smartFilterFormGroup.value.filters,
        })
      ).then((res) => {
        if (res.success) {
          this.smartFilterFormGroup.get("_id").setValue(res.data._id);
          this.nzNotificationService.success("Smart Filter", res.message);
          this.onSaved.emit();
        } else {
          this.nzNotificationService.error("Smart Filter", res.message);
        }
      });
    }
  }

  public get filterFormArray(): FormArray {
    return this.smartFilterFormGroup.get("filters") as FormArray;
  }
}
