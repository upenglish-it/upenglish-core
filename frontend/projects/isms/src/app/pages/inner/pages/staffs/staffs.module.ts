import { NgModule } from "@angular/core";
import { LayoutComponent } from "./layout/layout.component";
import { RouterModule } from "@angular/router";
import { StaffsRoutingModule } from "./staffs-routing.module";

@NgModule({
  declarations: [LayoutComponent],
  imports: [RouterModule, StaffsRoutingModule],
})
export class StaffsModule {}
