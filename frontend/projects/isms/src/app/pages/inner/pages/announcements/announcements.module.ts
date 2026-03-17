import { NgModule } from "@angular/core";
import { LayoutComponent } from "./layout/layout.component";
import { RouterModule } from "@angular/router";
import { AnnouncementsRoutingModule } from "./announcements-routing.module";

@NgModule({
  declarations: [LayoutComponent],
  imports: [RouterModule, AnnouncementsRoutingModule],
})
export class AnnouncementsModule {}
