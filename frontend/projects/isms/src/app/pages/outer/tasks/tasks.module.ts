import { NgModule } from "@angular/core";
import { TasksRoutingModule } from "./tasks-routing.module";
import { LayoutComponent } from "./layout/layout.component";

@NgModule({
  declarations: [LayoutComponent],
  imports: [TasksRoutingModule],
  providers: [],
})
export class TaskModule {}
