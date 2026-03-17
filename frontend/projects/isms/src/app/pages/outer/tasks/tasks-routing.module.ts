import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { LayoutComponent } from "./layout/layout.component";
import { TakingTaskPage } from "./pages/taking-task/taking-task.page";
import { RouterUtils } from "@isms-core/constants";
import { TasksPage } from "./pages/tasks/tasks.page";
import { TaskReportPage } from "./pages/task-report/task-report.page";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        component: TasksPage,
        data: {
          title: "Tasks",
        },
      },
      {
        path: RouterUtils.tasks.take.root,
        component: TakingTaskPage,
        data: {
          title: "Taking Task",
        },
      },
      {
        path: RouterUtils.tasks.report,
        component: TaskReportPage,
        data: {
          title: "Task Report",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TasksRoutingModule {}
