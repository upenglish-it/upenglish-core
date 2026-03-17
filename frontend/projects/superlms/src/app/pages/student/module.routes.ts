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
import { DashboardComponent } from "./pages/dashboard/dashboard.component";

export const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      //--- /
      { path: "", pathMatch: "full", redirectTo: "dashboard" },
      { path: "dashboard", pathMatch: "full", component: DashboardComponent },
      { path: "classes", loadChildren: () => import("./pages/classes/module.routes").then((m) => m.routes) },
    ],
  },
];
