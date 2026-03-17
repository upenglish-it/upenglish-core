import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { RouterUtils } from "@isms-core/constants";
import { LayoutComponent } from "./layout/layout.component";
import { BuilderPage } from "./pages/builder/builder.page";
import { SettingsPage } from "./pages/settings/settings.page";
import { SubmissionsPage } from "./pages/submissions/submissions.page";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: RouterUtils.inner.tasks.builder.builder,
        component: BuilderPage,
        data: {
          title: "Task builder",
        },
      },
      {
        path: RouterUtils.inner.tasks.builder.settings,
        component: SettingsPage,
        data: {
          title: "Task settings",
        },
      },
      {
        path: RouterUtils.inner.tasks.builder.submissions,
        component: SubmissionsPage,
        data: {
          title: "Submissions",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BuilderRoutingModule {}
