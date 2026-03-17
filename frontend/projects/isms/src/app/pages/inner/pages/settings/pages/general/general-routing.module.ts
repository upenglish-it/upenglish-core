import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { LayoutComponent } from "./layout/layout.component";
import { BranchesPage } from "./pages/branches/branches.page";
import { RouterUtils } from "@isms-core/constants";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        redirectTo: RouterUtils.inner.settings.general.branches,
        pathMatch: "full",
      },
      {
        path: RouterUtils.inner.settings.general.branches,
        component: BranchesPage,
        data: {
          title: "Branches",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GeneralRoutingModule {}
