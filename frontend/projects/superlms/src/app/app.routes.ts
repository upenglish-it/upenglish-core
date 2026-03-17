import { Routes } from "@angular/router";

export const routes: Routes = [
  { path: "a", loadChildren: () => import("./pages/admin/module.routes").then((m) => m.routes) },
  { path: "s", loadChildren: () => import("./pages/student/module.routes").then((m) => m.routes) },
  { path: "t", loadChildren: () => import("./pages/teacher/module.routes").then((m) => m.routes) },
  { path: "task", loadChildren: () => import("./pages/task/module.routes").then((m) => m.routes) },
  { path: "authenticate", loadChildren: () => import("./pages/authenticate/module.routes").then((m) => m.routes) },
];
