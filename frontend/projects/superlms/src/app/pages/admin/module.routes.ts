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
import { SettingsComponent } from "./pages/settings/settings.component";
import { TemplatesComponent } from "./pages/templates/templates.component";
import { TestDetailsLayoutComponent } from "./pages/courses/pages/layout/layout.component";
import { ClassesComponent } from "./pages/classes/classes.component";
import { ClassDetailsComponent } from "./pages/class-details/class-details.component";
import { StudentTestDetailsPage } from "./pages/student-test-details/student-test-details.component";

export const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      //--- /
      { path: "", pathMatch: "full", redirectTo: "templates" },

      { path: "templates", pathMatch: "full", component: TemplatesComponent },
      { path: "courses", pathMatch: "full", component: CoursesComponent },
      { path: "courses/:classId", pathMatch: "full", component: TestDetailsLayoutComponent },
      { path: "classes", pathMatch: "full", component: ClassesComponent },
      { path: "classes-detail/:classId", pathMatch: "full", component: ClassDetailsComponent },
      { path: "student-test-detail/:classId/:studentId", pathMatch: "full", component: StudentTestDetailsPage },
      { path: "settings", pathMatch: "full", component: SettingsComponent },
    ],
  },
];
