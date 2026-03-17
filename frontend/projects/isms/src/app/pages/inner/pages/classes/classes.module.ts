import { NgModule } from "@angular/core";
import { LayoutComponent } from "./layout/layout.component";
import { RouterModule } from "@angular/router";
import { ClassesRoutingModule } from "./classes-routing.module";

@NgModule({
  declarations: [LayoutComponent],
  imports: [RouterModule, ClassesRoutingModule],
})
export class ClassesModule {}
