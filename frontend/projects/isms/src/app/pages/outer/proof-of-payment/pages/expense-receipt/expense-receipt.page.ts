import { DatePipe, NgIf } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { ICashflow } from "@isms-core/interfaces";
import { ProofOfPaymentService } from "@isms-core/services";
import { Animations } from "@isms-core/constants";
import { lastValueFrom } from "rxjs";
import { FormattedCurrencyPipe } from "@isms-core/pipes";

@Component({
  templateUrl: "./expense-receipt.page.html",
  styleUrls: ["./expense-receipt.page.scss"],
  animations: [Animations.down],
  imports: [NgIf, DatePipe, FormattedCurrencyPipe],
})
export class ExpenseReceiptPage implements OnInit {
  public cashflow: ICashflow = null;

  constructor(
    private readonly proofOfPaymentService: ProofOfPaymentService,
    private readonly activatedRoute: ActivatedRoute
  ) {}

  public ngOnInit(): void {
    const transactionId = this.activatedRoute.snapshot.queryParams["urlCode"];
    lastValueFrom(this.proofOfPaymentService.fetchCashflowReceipt(transactionId)).then((res) => {
      if (res.success) {
        this.cashflow = res.data;
        setTimeout(() => window.print(), 1000);
      }
    });
  }
}
