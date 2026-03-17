import { Component } from "@angular/core";
import { Animations } from "@isms-core/constants";
import { ISegmentSelector } from "@isms-core/interfaces";
import { NgIf } from "@angular/common";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { ClassesSegmentOptions } from "./data";
import { PipelineListingComponent } from "@isms-core/components/pipelines/pipeline-listing/pipeline-listing.component";
import { LeadLinstingComponent } from "@isms-core/components/pipelines/lead-listing/lead-listing.component";

@Component({
  templateUrl: "./pipelines.page.html",
  animations: [Animations.down, Animations.default],
  imports: [NgIf, SegmentedSelectorComponent, PipelineListingComponent, LeadLinstingComponent],
})
export class PipelinesPage {
  public segmentOptions: Array<ISegmentSelector> = ClassesSegmentOptions;
  public segmentIndex = 0;
  public onChangeSegmentSelector(index: number): void {
    this.segmentIndex = index;
  }
}
