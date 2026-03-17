import { DatePipe, NgFor, NgIf } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { IAnnouncement, Task } from "@isms-core/interfaces";
import { AccountStore } from "@isms-core/ngrx";
import { AnnouncementsService, DashboardAdminService, TasksService } from "@isms-core/services";
import { NgApexchartsModule } from "ng-apexcharts";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { NzTagModule } from "ng-zorro-antd/tag";
import { lastValueFrom } from "rxjs";

@Component({
  selector: "isms-marketing-dashboard",
  templateUrl: "./marketing-dashboard.component.html",
  imports: [NgIf, NgFor, DatePipe, NzTagModule, ReactiveFormsModule, NzEmptyModule, NgApexchartsModule],
})
export class MarketingDashboardComponent implements OnInit {
  public wonLostPieChart: any = {
    chart: {
      height: 480,
      type: "pie",
    },
    series: [0, 0],
    labels: ["Won", "Lost"],
    colors: ["#34c38f", "#556ee6"],
    legend: {
      show: true,
      position: "bottom",
      horizontalAlign: "center",
      verticalAlign: "middle",
      floating: false,
      fontSize: "14px",
      offsetX: 0,
      offsetY: -10,
    },
    responsive: [
      {
        breakpoint: 600,
        options: {
          chart: {
            height: 240,
          },
          legend: {
            show: false,
          },
        },
      },
    ],
  };

  constructor(private readonly dashboardAdminService: DashboardAdminService) {}

  public ngOnInit(): void {
    lastValueFrom(this.dashboardAdminService.fetchStatistics()).then((res) => {
      // this.statistics = res.success ? res.data : { students: 0, staffs: 0, leads: 0, wonLeads: 0 };
      if (res.success) {
        this.wonLostPieChart.series[0] = res.data.wonLeads;
        this.wonLostPieChart.series[1] = res.data.leads;
      }
    });
  }
}
