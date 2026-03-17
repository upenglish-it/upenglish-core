import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { AnnouncementsPage } from "./pages/announcements/announcements.page";
import { LayoutComponent } from "./layout/layout.component";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        component: AnnouncementsPage,
        data: {
          title: "Announcements",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AnnouncementsRoutingModule {}
