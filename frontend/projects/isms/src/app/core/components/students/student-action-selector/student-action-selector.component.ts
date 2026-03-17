import { NgIf } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { Animations } from "@isms-core/constants";
import { StudentsService } from "@isms-core/services";
import { TLeadSelectorAction } from "@isms-core/types";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzIconModule } from "ng-zorro-antd/icon";
import { lastValueFrom } from "rxjs";

@Component({
  selector: "isms-student-action-selector",
  templateUrl: "./student-action-selector.component.html",
  animations: [Animations.default],
  imports: [NgIf, NzDropDownModule, NzButtonModule, NzIconModule],
})
export class StudentActionSelectorComponent {
  @Input("candidate-ids") public candidateIds: Array<string> = [];
  @Input("remove-from-this-pipeline-id") public removeFromThisPipelineId: string;
  @Input("pipeline-ids") public pipelineIds: Array<string>;

  @Output("on-action") public onAction: EventEmitter<TLeadSelectorAction> = new EventEmitter();

  constructor(private readonly studentsService: StudentsService) {}

  public removeFromThisPipeline(): void {
    lastValueFrom(
      this.studentsService.manage({
        action: "remove-from-pipelines",
        pipeline: {
          pipelineIds: [this.removeFromThisPipelineId],
        },
        leadIds: this.candidateIds,
      })
    ).then((res) => {
      if (res.success) {
        this.onAction.emit("removed");
      }
    });
  }
}
