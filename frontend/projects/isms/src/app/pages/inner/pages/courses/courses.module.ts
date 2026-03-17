import { NgModule } from "@angular/core";
import { LayoutComponent } from "./layout/layout.component";
import { RouterModule } from "@angular/router";
import { StudentsRoutingModule } from "./courses-routing.module";

@NgModule({
  declarations: [LayoutComponent],
  imports: [RouterModule, StudentsRoutingModule],
})
export class CoursesModule {}
