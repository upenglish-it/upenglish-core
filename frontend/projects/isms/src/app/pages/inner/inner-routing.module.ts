import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { LayoutComponent } from "./layout/layout.component";
import { RouterUtils } from "@isms-core/constants";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        redirectTo: RouterUtils.inner.dashboard.root,
        pathMatch: "full",
      },

      /* Dashboard */
      {
        path: RouterUtils.inner.dashboard.root,
        loadChildren: async () => (await import("./pages/home/home.module")).HomeModule,
      },

      /* Students */
      {
        path: RouterUtils.inner.students.root,
        loadChildren: async () => (await import("./pages/students/students.module")).StudentsModule,
      },

      /* Staffs */
      {
        path: RouterUtils.inner.staffs.root,
        loadChildren: async () => (await import("./pages/staffs/staffs.module")).StaffsModule,
      },

      /* Courses */
      {
        path: RouterUtils.inner.courses.root,
        loadChildren: async () => (await import("./pages/courses/courses.module")).CoursesModule,
      },

      /* Classes */
      {
        path: RouterUtils.inner.classes.root,
        loadChildren: async () => (await import("./pages/classes/classes.module")).ClassesModule,
      },

      /* Materials */
      {
        path: RouterUtils.inner.materials.root,
        loadChildren: async () => (await import("./pages/materials/materials.module")).MaterialsModule,
      },

      /* Cashflow */
      {
        path: RouterUtils.inner.cashflow.root,
        loadChildren: async () => (await import("./pages/cashflow/cashflow.module")).CashflowModule,
      },

      /* Templates */
      {
        path: RouterUtils.inner.templates.root,
        loadChildren: async () => (await import("./pages/templates/templates.module")).TemplatesModule,
      },

      /* Announcements */
      {
        path: RouterUtils.inner.announcements.root,
        loadChildren: async () => (await import("./pages/announcements/announcements.module")).AnnouncementsModule,
      },

      /* Tasks */
      {
        path: RouterUtils.inner.tasks.root,
        loadChildren: async () => (await import("./pages/tasks/tasks.module")).TasksModule,
      },

      /* Schedule */
      {
        path: RouterUtils.inner.schedule.root,
        loadChildren: async () => (await import("./pages/schedule/schedule.module")).ScheduleModule,
      },

      /* Calendar */
      {
        path: RouterUtils.inner.calendar.root,
        loadChildren: async () => (await import("./pages/calendar/calendar.module")).CalendarModule,
      },

      /* Settings */
      {
        path: RouterUtils.inner.settings.root,
        loadChildren: async () => (await import("./pages/settings/settings.module")).SettingsModule,
      },

      /* Pipeline */
      {
        path: RouterUtils.inner.pipelines.root,
        loadChildren: async () => (await import("./pages/pipeline/pipeline.module")).PipelineModule,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InnerRoutingModule {}
