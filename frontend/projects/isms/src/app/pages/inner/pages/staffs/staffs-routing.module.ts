import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { StaffsPage } from "./pages/staffs/staffs.page";
import { LayoutComponent } from "./layout/layout.component";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        component: StaffsPage,
        data: {
          title: "Staff",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StaffsRoutingModule {}
