import { DatePipe, NgFor, NgIf } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { IActivityLogs, IAnnouncement, Task } from "@isms-core/interfaces";
import { AccountStore } from "@isms-core/ngrx";
import { ActivityLogsService, AnnouncementsService, DashboardAdminService, TasksService } from "@isms-core/services";
import { NgApexchartsModule } from "ng-apexcharts";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { NzTagModule } from "ng-zorro-antd/tag";
import { lastValueFrom } from "rxjs";
import { ChartType } from "../admin-dashboard/admin-dashboard.component";
import { GenderChart } from "./data";
import { ProfilePhotoDirective } from "@isms-core/directives";

@Component({
  selector: "isms-receptionist-dashboard",
  templateUrl: "./receptionist-dashboard.component.html",
  imports: [NgIf, NgFor, DatePipe, NzTagModule, ReactiveFormsModule, NzEmptyModule, NgApexchartsModule, ProfilePhotoDirective],
})
export class ReceptionistDashboardComponent implements OnInit {
  genderChart: ChartType = GenderChart;
  public receptionActivityLogs: Array<IActivityLogs> = [];
  public studentActivityLogs: Array<IActivityLogs> = [];

  constructor(
    private readonly dashboardAdminService: DashboardAdminService,
    private readonly activityLogsService: ActivityLogsService
  ) {}

  public ngOnInit(): void {
    lastValueFrom(this.dashboardAdminService.fetchStatistics()).then((res) => {
      if (res.success) {
        // Gender
        // const maleGender = res.data.maleGender.filter((s: number) => s.gender === "male" && !s.lead)?.length || 0;
        // const femaleGender = res.data.femaleGender.filter((s:number) => s.gender === "female" && !s.lead)?.length || 0;

        this.genderChart.series[0] = res.data.maleStudent;
        this.genderChart.series[1] = res.data.femaleStudent;
      }
    });

    lastValueFrom(this.activityLogsService.fetch()).then((res) => {
      res.success ? (this.receptionActivityLogs = res.data.filter((a: IActivityLogs) => a.action === "receive-payment-from-material" || a.action === "expense")) : [];

      res.success ? (this.studentActivityLogs = res.data.filter((a: IActivityLogs) => a.action === "receive-payment-from-tuition" || a.action === "student-stop-learning")) : [];
    });
  }
}
