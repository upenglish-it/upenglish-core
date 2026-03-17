import { DatePipe, NgIf } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { IAccount, IClass, IClassStudentRecord } from "@isms-core/interfaces";
import { ProofOfPaymentService } from "@isms-core/services";
import { Animations } from "@isms-core/constants";
import { lastValueFrom } from "rxjs";
import { FormattedCurrencyPipe } from "@isms-core/pipes";

@Component({
  templateUrl: "./student-receipt.page.html",
  styleUrls: ["./student-receipt.page.scss"],
  animations: [Animations.down],
  imports: [NgIf, DatePipe, FormattedCurrencyPipe],
})
export class StudentReceiptPage implements OnInit {
  public studentReceipt: IStudentReceipt = null;

  constructor(
    private readonly proofOfPaymentService: ProofOfPaymentService,
    private readonly activatedRoute: ActivatedRoute
  ) {}

  public ngOnInit(): void {
    const urlCode = this.activatedRoute.snapshot.queryParams["urlCode"];
    lastValueFrom(this.proofOfPaymentService.fetchStudentReceipt(urlCode)).then((res) => {
      if (res.success) {
        this.studentReceipt = res.data;
        setTimeout(() => window.print(), 1000);
      }
    });
  }
}

interface IStudentReceipt {
  _id: string;
  paymentHistory: IStudentReceiptPaymentHistory;
  account: IAccount;
  class: IClass;
}

interface IStudentReceiptPaymentHistory {
  id: string;
  urlCode: string;
  transactionId: string;
  performedBy: string;
  data: IStudentReceiptPaymentHistoryData;
  createdAt: string;
}

interface IStudentReceiptPaymentHistoryData {
  originalTotalAmount: number;
  deductedTotalAmount: number;
  totalDays: number;
  savingsBalance: number;
  totalDebt: number;
  basePrice: number;
  discount: number;
  totalDiscount: number;
  fromDate: string;
  toDate: string;
  dates: IClassStudentRecord[];
  records: IClassStudentRecord[];
}
