import { DatePipe, NgFor, NgIf } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { EmploymentInformation, IAccount, IActivityLogs, IAnnouncement, Task } from "@isms-core/interfaces";
import { AccountStore } from "@isms-core/ngrx";
import { DashboardAdminService, AnnouncementsService, TasksService, ActivityLogsService } from "@isms-core/services";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { NzTagModule } from "ng-zorro-antd/tag";
import { lastValueFrom } from "rxjs";
import { NgApexchartsModule } from "ng-apexcharts";
import { IncomeAndExpense } from "./data";
import { RouterLink } from "@angular/router";

@Component({
  selector: "isms-admin-dashboard",
  templateUrl: "./admin-dashboard.component.html",
  imports: [NgIf, NgFor, DatePipe, RouterLink, NzTagModule, ReactiveFormsModule, NzEmptyModule, NgApexchartsModule, ProfilePhotoDirective],
})
export class AdminDashboardComponent implements OnInit {
  incomeAndExpense: ChartType = IncomeAndExpense;

  simplePieChart: ChartType = {
    chart: {
      height: 320,
      type: "pie",
    },
    series: [1, 2],
    labels: ["Male", "Female"],
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

  public announcements: Array<IAnnouncement> = [];
  public tasks: Array<Task> = [];
  public statistics: { students: number; staffs: number; leads: number; wonLeads: number } = { students: 0, staffs: 0, leads: 0, wonLeads: 0 };
  public birthDays: Array<IAccount> = [];
  public staffAnniversary: Array<EmploymentInformation> = [];
  public staffSalaryIncrease: Array<EmploymentInformation> = [];

  // Admin
  public marketingActivityLogs: Array<IActivityLogs> = [];
  public receptionActivityLogs: Array<IActivityLogs> = [];
  public studentActivityLogs: Array<IActivityLogs> = [];

  constructor(
    private readonly announcementsService: AnnouncementsService,
    private readonly dashboardAdminService: DashboardAdminService,
    private readonly tasksService: TasksService,
    private readonly activityLogsService: ActivityLogsService,
    public readonly accountStore: AccountStore
  ) {}

  public ngOnInit(): void {
    lastValueFrom(this.dashboardAdminService.fetchBirthdaysByMonth()).then((res) => {
      this.birthDays = res.success ? res.data : [];
    });

    lastValueFrom(this.dashboardAdminService.fetchStatistics()).then((res) => {
      this.statistics = res.success ? res.data : { students: 0, staffs: 0, leads: 0, wonLeads: 0 };

      if (res.success) {
        // Income
        const incomeAndExpense = res.data.incomeAndExpense as Array<{ expense: number; income: number; _id: { month: number; year: number } }>;
        this.incomeAndExpense.series[0].data = incomeAndExpense.map((i) => i.income);
        this.incomeAndExpense.series[1].data = incomeAndExpense.map((i) => i.expense);
        this.incomeAndExpense.labels = incomeAndExpense.map((i) => `${i._id.month}/${i._id.year}`);
      }
    });

    lastValueFrom(this.dashboardAdminService.fetchEmployeeAnniversary()).then((res) => {
      this.staffAnniversary = res.success ? res.data : [];
    });

    lastValueFrom(this.dashboardAdminService.fetchSalaryIncrease()).then((res) => {
      this.staffSalaryIncrease = res.success ? res.data : [];
    });

    lastValueFrom(this.announcementsService.fetchParticipantById()).then((res) => {
      this.announcements = res.success ? res.data : [];
    });

    lastValueFrom(this.tasksService.participantTasks()).then((res) => {
      this.tasks = res.success ? res.data : [];
    });

    lastValueFrom(this.activityLogsService.fetch()).then((res) => {
      res.success ? (this.marketingActivityLogs = res.data.filter((a: IActivityLogs) => a.action === "create-a-lead" || a.action === "assign-to-stage")) : [];
      res.success ? (this.receptionActivityLogs = res.data.filter((a: IActivityLogs) => a.action === "receive-payment-from-material" || a.action === "expense")) : [];

      res.success ? (this.studentActivityLogs = res.data.filter((a: IActivityLogs) => a.action === "receive-payment-from-tuition" || a.action === "student-stop-learning")) : [];
    });
  }
}

export interface ChartType {
  chart?: any;
  plotOptions?: any;
  colors?: any;
  series?: any;
  markers?: any;
  xaxis?: any;
  tooltip?: any;
  fill?: any;
  stroke?: any;
  labels?: any;
  legend?: any;
  type?: any;
  height?: any;
  responsive?: any;
  dataLabels?: any;
}
