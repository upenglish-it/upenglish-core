import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ListingPage } from "./pages/listing/listing.page";
import { LayoutComponent } from "./layout/layout.component";
import { BuilderPage } from "./pages/builder/pages/builder/builder.page";
import { RouterUtils } from "@isms-core/constants";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        component: ListingPage,
        data: {
          title: "Listing",
        },
      },
      {
        path: RouterUtils.inner.tasks.builder.root,
        loadChildren: async () => (await import("./pages/builder/builder.module")).BuilderModule,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TasksRoutingModule {}
