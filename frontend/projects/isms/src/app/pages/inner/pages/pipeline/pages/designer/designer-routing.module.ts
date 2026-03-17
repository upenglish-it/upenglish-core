import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { LayoutComponent } from "./layout/layout.component";
import { DesignerPipelinePage } from "./pages/pipeline/pipeline.page";
import { DesignerSettingsPage } from "./pages/settings/settings.page";
import { RouterUtils } from "@isms-core/constants";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: RouterUtils.inner.pipelines.designer.pipeline,
        component: DesignerPipelinePage,
        data: {
          title: "Pipeline",
        },
      },
      {
        path: RouterUtils.inner.pipelines.designer.settings,
        component: DesignerSettingsPage,
        data: {
          title: "Settings & Overview",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DesignerRoutingModule {}
