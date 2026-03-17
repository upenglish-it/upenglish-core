import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { CoursesPage } from "./pages/courses/courses.page";
import { LayoutComponent } from "./layout/layout.component";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        component: CoursesPage,
        data: {
          title: "Courses",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StudentsRoutingModule {}
