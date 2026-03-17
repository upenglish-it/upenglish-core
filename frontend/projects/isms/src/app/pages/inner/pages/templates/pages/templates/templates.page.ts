import { Component } from "@angular/core";
import { Animations } from "@isms-core/constants";
import { ISegmentSelector } from "@isms-core/interfaces";
import { NgIf } from "@angular/common";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { TemplatesSegmentOptions } from "./data";
import { TagListingComponent } from "@isms-core/components/templates/tags/tag-listing/tag-listing.component";
import { SourceListingComponent } from "@isms-core/components/templates/sources/source-listing/source-listing.component";

@Component({
  templateUrl: "./templates.page.html",
  animations: [Animations.down, Animations.default],
  imports: [NgIf, SegmentedSelectorComponent, TagListingComponent, SourceListingComponent],
})
export class TemplatesPage {
  public segmentOptions: Array<ISegmentSelector> = TemplatesSegmentOptions;
  public segmentIndex = 0;
  public onChangeSegmentSelector(index: number): void {
    this.segmentIndex = index;
  }
}
