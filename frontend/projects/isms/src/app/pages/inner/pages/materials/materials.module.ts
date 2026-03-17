import { NgModule } from "@angular/core";
import { LayoutComponent } from "./layout/layout.component";
import { RouterModule } from "@angular/router";
import { MaterialsRoutingModule } from "./materials-routing.module";
@NgModule({
  declarations: [LayoutComponent],
  imports: [RouterModule, MaterialsRoutingModule],
})
export class MaterialsModule {}
