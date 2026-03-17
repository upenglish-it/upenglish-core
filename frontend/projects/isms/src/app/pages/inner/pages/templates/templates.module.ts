import { NgModule } from "@angular/core";
import { LayoutComponent } from "./layout/layout.component";
import { RouterModule } from "@angular/router";
import { TemplatesRoutingModule } from "./templates-routing.module";

@NgModule({
  declarations: [LayoutComponent],
  imports: [RouterModule, TemplatesRoutingModule],
})
export class TemplatesModule {}
