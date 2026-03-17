import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ClassesPage } from "./pages/classes/classes.page";
import { LayoutComponent } from "./layout/layout.component";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        component: ClassesPage,
        data: {
          title: "Classes",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ClassesRoutingModule {}
