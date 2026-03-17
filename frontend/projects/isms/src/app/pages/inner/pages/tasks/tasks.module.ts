import { NgModule } from "@angular/core";
import { LayoutComponent } from "./layout/layout.component";
import { RouterModule } from "@angular/router";
import { TasksRoutingModule } from "./tasks-routing.module";

@NgModule({
  declarations: [LayoutComponent],
  imports: [RouterModule, TasksRoutingModule],
})
export class TasksModule {}
