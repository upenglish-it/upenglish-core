import { Component } from "@angular/core";
import { PipelineManageInfoComponent } from "@isms-core/components/pipelines/settings/manage-info/manage-info.component";
import { Animations } from "@isms-core/constants";
import { ISegmentSelector } from "@isms-core/interfaces";

@Component({
  selector: "isms-pipeline-designer-settings",
  templateUrl: "./settings.page.html",
  animations: [Animations.down],
  imports: [PipelineManageInfoComponent],
})
export class DesignerSettingsPage {}
