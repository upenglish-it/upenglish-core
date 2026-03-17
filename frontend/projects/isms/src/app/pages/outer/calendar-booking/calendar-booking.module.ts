import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { LayoutComponent } from "./layout/layout.component";
import { BookPage } from "./pages/book/book.page";
import { NzCalendarModule } from "ng-zorro-antd/calendar";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { CalendarBookingRoutingModule } from "./calendar-booking-routing.module";
import { NzButtonModule } from "ng-zorro-antd/button";
import { DatePipe, NgFor } from "@angular/common";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzRadioModule } from "ng-zorro-antd/radio";
@NgModule({
  declarations: [LayoutComponent, BookPage],
  imports: [
    NgFor,
    FormsModule,
    ReactiveFormsModule,
    CalendarBookingRoutingModule,
    NzCalendarModule,
    NzDatePickerModule,
    NzButtonModule,
    NzSelectModule,
    NzRadioModule,
    NzIconModule,
    DatePipe,
  ],
})
export class CalendarBookingModule {}
