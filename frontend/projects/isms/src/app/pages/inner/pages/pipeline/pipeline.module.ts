import { NgModule } from "@angular/core";
import { LayoutComponent } from "./layout/layout.component";
import { RouterModule } from "@angular/router";
import { PipelineRoutingModule } from "./pipeline-routing.module";

@NgModule({
  declarations: [LayoutComponent],
  imports: [RouterModule, PipelineRoutingModule],
})
export class PipelineModule {}
