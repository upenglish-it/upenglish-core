import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { LayoutComponent } from "./layout/layout.component";
import { StaffPayslipPage } from "./pages/staff-payslip/staff-payslip.page";
import { StudentReceiptPage } from "./pages/student-receipt/student-receipt.page";
import { RouterUtils } from "@isms-core/constants";
import { ExpenseReceiptPage } from "./pages/expense-receipt/expense-receipt.page";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: RouterUtils.proofOfPayment.staffPayslip,
        component: StaffPayslipPage,
        data: {
          title: "Staff Payslip",
        },
      },
      {
        path: RouterUtils.proofOfPayment.studentReceipt,
        component: StudentReceiptPage,
        data: {
          title: "Student Receipt",
        },
      },
      {
        path: RouterUtils.proofOfPayment.expenseReceipt,
        component: ExpenseReceiptPage,
        data: {
          title: "Expense Receipt",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProofOfPaymentRoutingModule {}
