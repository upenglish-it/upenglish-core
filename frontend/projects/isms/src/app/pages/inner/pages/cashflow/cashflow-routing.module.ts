import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { CashflowPage } from "./pages/cashflow/cashflow.page";
import { LayoutComponent } from "./layout/layout.component";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        component: CashflowPage,
        data: {
          title: "Cashflow",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CashflowRoutingModule {}
