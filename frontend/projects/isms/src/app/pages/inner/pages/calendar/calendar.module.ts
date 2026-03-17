import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { LayoutComponent } from "./layout/layout.component";
import { CalendarRoutingModule } from "./calendar-routing.module";
import { NzButtonModule } from "ng-zorro-antd/button";

@NgModule({
  declarations: [LayoutComponent],
  imports: [CalendarRoutingModule, CommonModule, FormsModule, ReactiveFormsModule, NzButtonModule],
})
export class CalendarModule {}
