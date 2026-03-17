import { Component } from "@angular/core";
import { Animations } from "@isms-core/constants";
import { ISegmentSelector } from "@isms-core/interfaces";
import { NgIf } from "@angular/common";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { ClassesSegmentOptions } from "./data";
import { IncomeListingComponent } from "@isms-core/components/cashflow/income/income-listing/income-listing.component";
import { ExpenseListingComponent } from "@isms-core/components/cashflow/expense/expense-listing/expense-listing.component";

@Component({
  templateUrl: "./cashflow.page.html",
  animations: [Animations.down, Animations.default],
  imports: [NgIf, SegmentedSelectorComponent, IncomeListingComponent, ExpenseListingComponent],
})
export class CashflowPage {
  public segmentOptions: Array<ISegmentSelector> = ClassesSegmentOptions;
  public segmentIndex = 0;
  public onChangeSegmentSelector(index: number): void {
    this.segmentIndex = index;
  }
}
