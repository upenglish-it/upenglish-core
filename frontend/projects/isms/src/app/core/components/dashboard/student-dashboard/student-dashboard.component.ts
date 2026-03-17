import { DatePipe, NgFor, NgIf } from "@angular/common";
import { Component, OnInit, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IAnnouncement, IClass, IClassStudent, Task, TaskSubmission } from "@isms-core/interfaces";
import { AccountStore } from "@isms-core/ngrx";
import { AnnouncementsService, ClassesService, TasksService } from "@isms-core/services";
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexLegend,
  ApexMarkers,
  ApexStroke,
  ApexTitleSubtitle,
  ApexXAxis,
  ApexYAxis,
  ChartComponent,
  NgApexchartsModule,
} from "ng-apexcharts";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzSegmentedModule, NzSegmentedOption } from "ng-zorro-antd/segmented";
import { debounceTime, lastValueFrom } from "rxjs";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { DateTime } from "luxon";
import { isEmpty } from "lodash";
import { environment } from "@isms-env/environment";

@Component({
  selector: "isms-student-dashboard",
  templateUrl: "./student-dashboard.component.html",
  imports: [
    NgIf,
    NgFor,
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    NzTagModule,
    NzSelectModule,
    NzDatePickerModule,
    ReactiveFormsModule,
    NzEmptyModule,
    NzSegmentedModule,
    NgApexchartsModule,
  ],
})
export class StudentDashboardComponent implements OnInit {
  public challengesFilterFormGroup = new FormGroup({
    class: new FormControl(null),
    date: new FormControl(DateTime.now().toJSDate()),
  });
  public announcements: Array<IAnnouncement> = [];
  public tasks: Array<Task> = [];
  public submissions: Array<TaskSubmission> = [];
  public myClasses: Array<IClassStudent> = [];
  public classes: Array<IClass> = [];

  @ViewChild("chart") chart: ChartComponent;
  public challengesChart: Partial<ChartOptions>;

  public taskOptionSelectedIndex: number = 0;
  public readonly taskOptions: NzSegmentedOption[] = [
    { label: "Ongoing", value: "ongoing-task" },
    { label: "History", value: "task-history" },
  ];
  public handleIndexChange(e: string | number): void {
    console.log(e);
  }

  constructor(
    private readonly announcementsService: AnnouncementsService,
    private readonly classesService: ClassesService,
    private readonly tasksService: TasksService,
    public readonly accountStore: AccountStore
  ) {}

  public ngOnInit(): void {
    this.challengesFilterFormGroup.valueChanges.pipe(debounceTime(300)).subscribe((value) => {
      console.log("value", value);
      this.loadChallengesReport();
    });

    lastValueFrom(this.classesService.fetchStudentClasses()).then((res) => {
      this.myClasses = res.success ? res.data : [];
    });

    lastValueFrom(this.announcementsService.fetchParticipantById()).then((res) => {
      this.announcements = res.success ? res.data : [];
    });

    lastValueFrom(this.tasksService.participantTasks()).then((res) => {
      this.tasks = res.success ? res.data : [];
    });

    lastValueFrom(this.tasksService.participantSubmissions()).then((res) => {
      this.submissions = res.success ? res.data : [];
      console.log("ress", res);
    });

    lastValueFrom(this.classesService.fetch({ limit: 100 }))
      .then((res) => {
        if (res.success) {
          this.classes = res.success ? res.data : [];
          // this.challengesFilterFormGroup.patchValue({
          //   class: this.classes[0]
          // });
        }
      })
      .finally(() => {
        if (this.classes.length > 0) {
        }
        this.challengesFilterFormGroup.patchValue({
          class: this.classes[0]._id,
          // date: DateTime.now().toJSDate()
        });
      });

    this.challengesChart = {
      series: [
        // {
        //   name: "Official",
        //   data: [45, 52, 38, 24, 33, 26, 21, 20, 6, 8, 15, 10]
        // },
        // {
        //   name: "Training",
        //   data: [35, 41, 62, 42, 13, 18, 29, 37, 36, 51, 32, 35]
        // }
        // {
        //   name: "Total Visits",
        //   data: [87, 57, 74, 99, 75, 38, 62, 47, 82, 56, 45, 47]
        // }
      ],
      chart: {
        height: 350,
        type: "line",
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        width: 5,
        curve: "smooth",
        dashArray: [0, 0, 0],
      },
      // title: {
      //   text: "Challenges",
      //   align: "left"
      // },
      // legend: {
      //   tooltipHoverFormatter: function (val, opts) {
      //     return val + " - <strong>" + opts.w.globals.series[opts.seriesIndex][opts.dataPointIndex] + "</strong>";
      //   }
      // },
      markers: {
        size: 0,
        hover: {
          sizeOffset: 6,
        },
      },
      xaxis: {
        labels: {
          trim: false,
        },
        categories: [], //["01 Jan", "02 Jan", "03 Jan", "04 Jan", "05 Jan", "06 Jan", "07 Jan", "08 Jan", "09 Jan", "10 Jan", "11 Jan", "12 Jan"]
      },
      yaxis: {
        title: {
          text: "Percent",
        },
      },
      tooltip: {
        y: [
          {
            title: {
              formatter: function (val: string) {
                return val; // + " (mins)";
              },
            },
          },
          {
            title: {
              formatter: function (val: string) {
                return val; //+ " per session";
              },
            },
          },
          {
            title: {
              formatter: function (val: any) {
                return val;
              },
            },
          },
        ],
      },
      grid: {
        borderColor: "#f1f1f1",
      },
    };
  }

  private loadChallengesReport(): void {
    lastValueFrom(
      this.tasksService.reports({
        class: this.challengesFilterFormGroup.value.class,
        ...(this.challengesFilterFormGroup.value.date ? { date: DateTime.fromJSDate(this.challengesFilterFormGroup.value.date).toISO() } : {}),
      })
    ).then((res) => {
      if (res.success) {
        console.log("reports", res);

        this.challengesChart.series = res.data.series;
        this.challengesChart.xaxis.categories = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; // res.data.categories;
      }
    });
  }

  /**
   * viewTask
   */
  public viewTask(task: Task): void {
    window.location.replace(`/tasks/${task._id}?type=${task.mode}`);
  }

  public goToSuperLMS(): void {
    const url = `${environment.superLMS}/authenticate/verify?role=${this.accountStore.account.role}&email=${this.accountStore.account.emailAddresses[0]}`;
    window.open(url, "_blank").focus();
  }
}

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  stroke: ApexStroke;
  dataLabels: ApexDataLabels;
  markers: ApexMarkers;
  tooltip: any; // ApexTooltip;
  yaxis: ApexYAxis;
  grid: ApexGrid;
  legend: ApexLegend;
  title: ApexTitleSubtitle;
};
