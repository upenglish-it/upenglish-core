import { NgModule } from "@angular/core";
import { LayoutComponent } from "./layout/layout.component";
import { ScheduleRoutingModule } from "./schedule-routing.module";

@NgModule({
  declarations: [LayoutComponent],
  imports: [ScheduleRoutingModule],
})
export class ScheduleModule {}
