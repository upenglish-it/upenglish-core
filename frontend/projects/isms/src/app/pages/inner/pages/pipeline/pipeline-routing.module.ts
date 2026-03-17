import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { PipelinesPage } from "./pages/pipelines/pipelines.page";
import { LayoutComponent } from "./layout/layout.component";
import { RouterUtils } from "@isms-core/constants";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        component: PipelinesPage,
        data: {
          title: "Pipelines",
        },
      },

      /* Designer */
      {
        path: RouterUtils.inner.pipelines.designer.root,
        loadChildren: async () => (await import("./pages/designer/designer.module")).DesignerModule,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PipelineRoutingModule {}
