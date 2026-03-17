/**
 * Module Routes
 *
 * @file          module.routes
 * @description   Routes for modules task
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Routes } from "@angular/router";
//--- Pages
import { LayoutComponent } from "./layout/layout.component";
import { VerifyComponent } from "./pages/verify/verify.component";

export const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [{ path: "verify", pathMatch: "full", component: VerifyComponent }],
  },
];
