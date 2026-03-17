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
import { TakingTaskComponent } from "./pages/taking-task/taking-task.component";
import { BuilderComponent } from "./pages/builder/builder.component";

export const routes: Routes = [
  {
    path: ":taskId",
    component: LayoutComponent,
    children: [
      { path: "builder", pathMatch: "full", component: BuilderComponent },
      { path: "taking-task", pathMatch: "full", component: TakingTaskComponent },
    ],
  },
];
