import { NgModule } from "@angular/core";
import { BuilderRoutingModule } from "./builder-routing.module";
import { LayoutComponent } from "./layout/layout.component";
import { DatePipe, NgFor, NgIf } from "@angular/common";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";

@NgModule({
  declarations: [LayoutComponent],
  imports: [NgIf, NgFor, DatePipe, BuilderRoutingModule, NzTagModule, NzButtonModule, NzIconModule, SegmentedSelectorComponent],
})
export class BuilderModule {}
