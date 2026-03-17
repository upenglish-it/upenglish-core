import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { MaterialsPage } from "./pages/materials/materials.page";
import { LayoutComponent } from "./layout/layout.component";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        component: MaterialsPage,
        data: {
          title: "Items",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MaterialsRoutingModule {}
