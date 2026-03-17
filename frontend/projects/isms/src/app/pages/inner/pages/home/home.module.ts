import { NgModule } from "@angular/core";
import { HomeRoutingModule } from "./home-routing.module";
import { LayoutComponent } from "./layout/layout.component";
import { DashboardPage } from "./pages/dashboard/dashboard.page";
import { DashboardManagePage } from "./pages/manage/manage.page";
import { NgFor } from "@angular/common";

@NgModule({
  declarations: [
    LayoutComponent,

    // Pages
    DashboardManagePage,
  ],
  imports: [NgFor, HomeRoutingModule],
})
export class HomeModule {}
