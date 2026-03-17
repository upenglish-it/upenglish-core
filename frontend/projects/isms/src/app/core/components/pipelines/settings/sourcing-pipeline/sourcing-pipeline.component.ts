import { JsonPipe, NgClass, NgFor, NgIf } from "@angular/common";
import { Component, Input } from "@angular/core";
import { AbstractControl, FormArray, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { SectionContainerComponent } from "@isms-core/components/common/section-container/section-container.component";
import { PipelineStageFormGroup } from "@isms-core/form-group";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NgxTinymceModule } from "ngx-tinymce";
import { CdkDragDrop, CdkDropList, CdkDrag } from "@angular/cdk/drag-drop";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { Pipeline, PipelineLead } from "@isms-core/interfaces";
import { NzModalModule, NzModalService } from "ng-zorro-antd/modal";
import { NzDividerModule } from "ng-zorro-antd/divider";
import { SortFormArrayPipe } from "@isms-core/pipes/src/sort-form-array.pipe";

@Component({
  selector: "isms-pipeline-sourcing-pipeline",
  templateUrl: "./sourcing-pipeline.component.html",
  imports: [
    NgClass,
    NgIf,
    NgFor,
    JsonPipe,
    ReactiveFormsModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzButtonModule,
    NzToolTipModule,
    NzIconModule,
    NzDividerModule,
    NzPopconfirmModule,
    NzDropDownModule,
    NzSwitchModule,
    NgxTinymceModule,
    CdkDropList,
    CdkDrag,
    SectionContainerComponent,
    NzModalModule,
    SortFormArrayPipe,
  ],
})
export class SourcingPipelineComponent {
  @Input("form-group") formGroup: FormGroup;
  @Input("pipeline") pipeline: Pipeline;
  public selectedStageIndex: number = 0;

  constructor(private readonly nzModalService: NzModalService) {}

  public onAddStage(): void {
    const formGroup = PipelineStageFormGroup();
    formGroup.get("order").setValue(0);
    formGroup.get("state").setValue("start");
    formGroup.get("type").setValue("sourced");
    formGroup.get("title").setValue("Untitled");
    this.stagesFormArray.push(formGroup);
    this.selectedStageIndex = this.stagesFormArray.length - 1; // set the last index
  }

  public onDeleteStage(): void {
    const stage = this.stagesFormArray.at(this.selectedStageIndex).value;
    const items = this.pipeline.items as Array<PipelineLead>;
    const leads = items.filter((lead) => lead.pipelineStageId === stage.id);
    if (leads.length > 0) {
      this.nzModalService.confirm({
        nzBodyStyle: { "padding-left": "16px", "padding-right": "16px", "padding-bottom": "10px", "padding-top": "16px" },
        nzTitle: `This stage contains leads. <br>Please move the leads to other stage before deleting.`,
        // nzOkText: "Delete",
        // nzOkType: "primary",
        // nzOkDanger: true,
        nzCancelText: "Close",
        // nzOnCancel: () => {}
        // nzOnOk: () => {
        //   this.stagesFormArray.removeAt(this.selectedStageIndex);
        //   this.selectedStageIndex = 0;
        // }
      });
    } else {
      this.stagesFormArray.removeAt(this.selectedStageIndex);
      this.selectedStageIndex = 0;
    }
  }

  public sortStage(event: CdkDragDrop<string[]>) {
    const previousIndex = event.previousIndex;
    const currentIndex = event.currentIndex;

    const control = this.editableStagesFormArray.at(previousIndex);
    this.editableStagesFormArray.removeAt(previousIndex);
    this.editableStagesFormArray.insert(currentIndex, control);
  }

  public get stagesFormArray(): FormArray {
    return this.formGroup.get("stages") as FormArray;
  }

  public get editableStagesFormArray(): FormArray {
    return this.formGroup.get("stages") as FormArray;
  }

  public get stageFormGroup(): FormGroup {
    return this.stagesFormArray.controls[this.selectedStageIndex] as FormGroup;
  }

  public toFormGroup(formGroup: AbstractControl): FormGroup {
    return formGroup as FormGroup;
  }
}
