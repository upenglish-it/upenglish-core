import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { RouterUtils } from "@isms-core/constants";
import { LayoutComponent } from "./layout/layout.component";
import { DashboardManagePage } from "./pages/manage/manage.page";
import { DashboardPage } from "./pages/dashboard/dashboard.page";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        component: DashboardPage,
        data: {
          title: "Dashboard",
        },
      },
      {
        path: RouterUtils.inner.dashboard.manage,
        component: DashboardManagePage,
        data: {
          title: "Manage",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HomeRoutingModule {}
