import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { LayoutComponent } from "./layout/layout.component";
import { BookPage } from "./pages/book/book.page";
import { RouterUtils } from "@isms-core/constants";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        redirectTo: RouterUtils.calendarBooking.book,
        pathMatch: "full",
      },
      {
        path: RouterUtils.calendarBooking.book,
        component: BookPage,
        data: {
          title: "Book Interview",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CalendarBookingRoutingModule {}
