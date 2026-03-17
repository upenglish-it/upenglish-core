import { NgModule } from "@angular/core";
import { LayoutComponent } from "./layout/layout.component";
import { RouterModule } from "@angular/router";
import { CashflowRoutingModule } from "./cashflow-routing.module";

@NgModule({
  declarations: [LayoutComponent],
  imports: [RouterModule, CashflowRoutingModule],
})
export class CashflowModule {}
