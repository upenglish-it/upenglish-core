import { DatePipe, JsonPipe, NgFor, NgIf } from "@angular/common";
import { Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { ManageLeaveModalComponent } from "@isms-core/components/settings/my-account/manage-leave-modal/manage-leave-modal.component";
import { ILeave } from "@isms-core/interfaces";
import { LeavesService } from "@isms-core/services";
import { DateTime, Interval } from "luxon";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzSelectModule } from "ng-zorro-antd/select";
import { lastValueFrom } from "rxjs";

@Component({
  templateUrl: "./leaves.page.html",
  imports: [NgIf, NgFor, DatePipe, JsonPipe, ReactiveFormsModule, NzSelectModule, NzButtonModule, NzIconModule, ManageLeaveModalComponent],
})
export class LeavesPage {
  public leaves: Array<ILeave>;

  constructor(private readonly leavesService: LeavesService) {}

  public ngOnInit(): void {
    this.loadData();
  }

  public loadData(): void {
    lastValueFrom(this.leavesService.fetchStaffRequest()).then((res) => {
      this.leaves = [];
      if (res.success) {
        this.leaves = (res.data as Array<ILeave>).map((item) => {
          item["selected"] = false;
          const startDate = DateTime.fromISO(item.dates.at(0).date, { zone: "UTC" }).startOf("day");
          const toDate = DateTime.fromISO(item.dates.at(item.dates.length - 1).date, { zone: "UTC" }).endOf("day");
          item["totalDaysOfLeave"] = Math.round(Interval.fromDateTimes(startDate, toDate).toDuration("days").days);
          return item;
        });
      }
    });
  }
}
