import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { StudentsPage } from "./pages/students/students.page";
import { LayoutComponent } from "./layout/layout.component";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        component: StudentsPage,
        // loadChildren: async () => (await import("./pages/students/students.page")).StudentsPage,
        data: {
          title: "Students",
        },
      },
      // {
      //     path: `${ROUTER_UTILS.inner.candidates.activities}/:candidateId`,
      //   component: StudentsPage,
      //   // loadChildren: async () => (await import("./pages/students/students.page")).StudentsPage,
      //   data: {
      //     title: "Tuition & Attendance"
      //   }
      // }
      // {
      //   path: `${ROUTER_UTILS.inner.candidates.activities}/:candidateId`,
      //   component: CandidatesActivitiesPage,
      //   data: {
      //     title: 'Activities',
      //   },
      // },
      // {
      //   path: RouterUtils.inner.students.bulkUpload.root,
      //   loadChildren: async () => (await import("./pages/bulk-upload/bulk-upload.module")).CandidatesBulkUploadModule
      // }
      // {
      //   path: ROUTER_UTILS.inner.candidates.bulkUpload,
      //   component: CandidatesBulkUploadPage,
      //   data: {
      //     title: 'Bulk Upload',
      //   },
      // },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StudentsRoutingModule {}
