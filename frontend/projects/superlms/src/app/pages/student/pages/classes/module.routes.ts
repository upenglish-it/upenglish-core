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
import { DetailsComponent } from "./pages/details/details.component";

export const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      //--- /
      { path: ":classId", pathMatch: "full", component: DetailsComponent },
    ],
  },
];
