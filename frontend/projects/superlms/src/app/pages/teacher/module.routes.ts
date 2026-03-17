// import { NgModule } from "@angular/core";
// import { RouterModule, Routes } from "@angular/router";
// import { LayoutComponent } from "./layout/layout.component";
// import { BuilderPage } from "./pages/builder/builder.page";

// const routes: Routes = [
//   {
//     path: "",
//     component: LayoutComponent,
//     children: [
//       {
//         path: "",
//         redirectTo: "builder",
//         pathMatch: "full",
//       },
//       {
//         path: "builder",
//         component: BuilderPage,
//         data: {
//           title: "Log In",
//         },
//       },
//     ],
//   },
// ];

// @NgModule({
//   imports: [RouterModule.forChild(routes)],
//   exports: [RouterModule],
// })
// export class RoutingModule {}

/**
 * Module Routes
 *
 * @file          module.routes
 * @description   Routes for modules
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Routes } from "@angular/router";
//--- Pages
import { LayoutComponent } from "./layout/layout.component";
import { CoursesComponent } from "./pages/courses/courses.component";
import { ClassesComponent } from "./pages/classes/classes.component";
import { DashboardComponent } from "./pages/dashboard/dashboard.component";
import { ClassDetailsComponent } from "./pages/class-details/class-details.component";
import { TestDetailsLayoutComponent } from "./pages/courses/pages/layout/layout.component";
import { StudentTestDetailsPage } from "./pages/student-test-details/student-test-details.component";

export const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      //--- /
      { path: "", pathMatch: "full", redirectTo: "dashboard" },
      { path: "dashboard", pathMatch: "full", component: DashboardComponent },
      { path: "courses", pathMatch: "full", component: CoursesComponent },
      { path: "courses/:classId", pathMatch: "full", component: TestDetailsLayoutComponent },
      { path: "classes", pathMatch: "full", component: ClassesComponent },
      { path: "classes-detail/:classId", pathMatch: "full", component: ClassDetailsComponent },
      { path: "student-test-detail/:classId/:studentId", pathMatch: "full", component: StudentTestDetailsPage },
    ],
  },
];
