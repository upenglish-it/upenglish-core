/**
 * Student Test Details Component
 *
 * @file          student-test-details.component
 * @description   Student Test Details for student
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Component, inject, Input, OnInit } from "@angular/core";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
import { AccountService } from "@superlms/services/account/account.service";
//--- PrimeNG
import { TagModule } from "primeng/tag";
//--- NG Zorro
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzBadgeModule } from "ng-zorro-antd/badge";
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import { NzSegmentedModule } from "ng-zorro-antd/segmented";
import { NzListModule } from "ng-zorro-antd/list";
import { NzTimelineModule } from "ng-zorro-antd/timeline";
import { NzButtonModule } from "ng-zorro-antd/button";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { AnnouncementI, GetRedFlagsI, GetStudentTestDetailsResponseI } from "@superlms/models/tests/test-of-class/test-of-class.endpoints.get.model";
import { TaskTimelineI } from "@superlms/models/tasks/tasks.endpoints.datatypes";
import { TimelineTestResultComponent } from "./timeline-test-result/timeline-test-result.component";
import { DatePipe } from "@angular/common";
import { NzModalService } from "ng-zorro-antd/modal";
import { NzPopconfirmDirective } from "ng-zorro-antd/popconfirm";
import { AddRedFlagModalComponent } from "./add-red-flag-modal/add-red-flag-modal.component";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { NzSelectModule } from "ng-zorro-antd/select";
import { AnnouncementModalComponent } from "./announcement-modal/announcement-modal.component";
import { AttendanceI, IAccount } from "@isms-core/interfaces";

@Component({
  selector: "slms-student-test-details",
  imports: [
    //--- NG Modules
    DatePipe,
    RouterLink,
    FormsModule,
    //--- PrimeNG
    TagModule,
    //--- NG Zorro
    NzTagModule,
    NzListModule,
    NzEmptyModule,
    NzBadgeModule,
    NzAlertModule,
    NzButtonModule,
    NzToolTipModule,
    NzSelectModule,
    NzTimelineModule,
    NzCollapseModule,
    NzSegmentedModule,
    ProfilePhotoDirective,
    //--- Components
    AddRedFlagModalComponent,
    AnnouncementModalComponent,
    TimelineTestResultComponent,
  ],
  providers: [NzModalService],
  templateUrl: "./student-test-details.component.html",
  styleUrl: "./student-test-details.component.less",
})
export class StudentTestDetailsComponent implements OnInit {
  //--- Input
  @Input({ alias: "student-id", required: true }) public studentId: string;
  @Input({ alias: "class-id", required: true }) public classId: string;

  //--- Injectables
  private apiService: ApiService = inject(ApiService);
  public announcements: AnnouncementI[] = [];
  public accountService: AccountService = inject(AccountService);
  public nzModalService: NzModalService = inject(NzModalService);

  //--- Public
  public testDetails: GetStudentTestDetailsResponseI | null = null;
  public studentDetail: IAccount[] | null = null;
  public timelines: TaskTimelineI[] = [];
  public timelinePage = 1;
  public timelineLimit = 6;
  public timelineLoading = false;
  public hasMoreTimeline = true;
  public redflags: GetRedFlagsI[] = [];
  public selectedSection = "assignments-and-tests";
  public reviewedCount = 0;
  public sections = [
    { label: "Assignments and Tests", value: "assignments-and-tests" },
    { label: "Timeline", value: "timeline" },
  ];

  public selectedTimelineSection = "all";
  public timelineSections = [
    { label: "All", value: "all" },
    { label: "Test Results", value: "test-results" },
    { label: "Comments", value: "comments" },
  ];

  /** Selected month (1–12) and year for attendance and test details. Changing refetches data. */
  public selectedAttendanceMonth = new Date().getMonth() + 1;
  public selectedAttendanceYear = new Date().getFullYear();

  public monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i, 1).toLocaleString("default", { month: "long" }),
  }));

  public yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.loadTestOfClass();
    this.loadTimeline();
    this.loadRedFlags();
  }

  public loadTestOfClass(): void {
    const month = this.selectedAttendanceMonth;
    const year = this.selectedAttendanceYear;

    this.apiService.endPointsC.testOfClass.get
      .getStudentTestDetails(this.apiService, {
        classId: this.classId,
        studentId: this.studentId,
        date: `${month}-${year}`,
      })
      .then((res) => {
        if (res.success) {
          this.testDetails = res.data;
          this.studentDetail = res.data.student as any;
          this.reviewedCount = 0;

          this.testDetails.test.periods.map((period) => {
            period.sections.map((section) => {
              section.tests.map((test) => {
                //--- Push the computed properties
                let totalNeedToReviewItems = 0;
                let totalQuestions = 0;
                let totalPoints = 0;

                test.test.variations.forEach((variation) => {
                  variation.parts.forEach((part) => {
                    part.items.forEach((item) => {
                      if (!item.reviewed) {
                        totalNeedToReviewItems += 1;
                      }
                      totalQuestions += 1;
                      totalPoints += item.score;
                      return item;
                    });
                    return part;
                  });

                  return variation;
                });

                test.test.totalNeedToReviewItems = totalNeedToReviewItems;
                test.test.totalQuestions = totalQuestions;
                test.test.totalPoints = totalPoints;

                return test;
              });
              return section;
            });

            this.reviewedCount += period.totalReviewedSections;
            return period;
          });

          this.loadAnnouncement();
        }
      });
  }

  public loadRedFlags(): void {
    this.redflags = [];
    this.apiService.endPointsC.testOfClass.get.redFlags(this.apiService, { classId: this.classId, studentId: this.studentId }).then((res) => {
      if (res.success) {
        this.redflags = res.data;
        console.log("this.loadRedFlags", this.redflags);
      }
    });
  }

  public loadAnnouncement(): void {
    this.announcements = [];
    this.apiService.endPointsC.testOfClass.get.announcementById(this.apiService, { testOfClassId: this.testDetails!.test._id }).then((res) => {
      if (res.success) {
        this.announcements = res.data;
        console.log("this.loadAnnouncement", this.announcements);
      }
    });
  }

  public deleteAnnouncementById(id: string): void {
    this.apiService.endPointsC.testOfClass.delete.deleteAnnouncementById(this.apiService, id).then((res) => {
      if (res.success) {
        this.loadAnnouncement();
      }
    });
  }

  public loadTimeline(): void {
    this.timelines = [];
    this.timelinePage = 1;
    this.hasMoreTimeline = true;
    this.apiService.endPointsC.tasks.get.getTimelineByClass(this.apiService, this.classId, { page: 1, limit: this.timelineLimit }).then((res) => {
      if (res.success) {
        this.timelines = res.data.items ?? [];
        this.hasMoreTimeline = (res.data.items?.length ?? 0) >= this.timelineLimit;
      }
    });
  }

  public loadMoreTimeline(): void {
    if (this.timelineLoading || !this.hasMoreTimeline) return;
    this.timelineLoading = true;
    const nextPage = this.timelinePage + 1;
    this.apiService.endPointsC.tasks.get
      .getTimelineByClass(this.apiService, this.classId, { page: nextPage, limit: this.timelineLimit })
      .then((res) => {
        if (res.success && res.data.items?.length) {
          this.timelines = [...this.timelines, ...res.data.items];
          this.timelinePage = nextPage;
          this.hasMoreTimeline = res.data.items.length >= this.timelineLimit;
        } else {
          this.hasMoreTimeline = false;
        }
      })
      .finally(() => {
        this.timelineLoading = false;
      });
  }

  public resetTestSection(periodId: string, sectionId: string): void {
    console.log(">>>>", periodId, sectionId);
    this.nzModalService.confirm({
      nzTitle: "Do you want to reset this test section?",
      nzContent: "This action cannot be undone.",
      nzOkText: "Reset",
      nzOkDanger: true,
      nzOnOk: () => {
        this.apiService.endPointsC.testOfClass.patch.resetTest(this.apiService, { studentId: this.studentId, periodId: periodId, sectionId: sectionId }).then((res) => {
          if (res.success) {
            this.loadTestOfClass();
          }
        });
      },
    });
  }

  public goBack(): void {
    window.history.back();
  }

  /** Raw attendance from API: { day, month, year, included, enable } */
  public get attendanceList(): Array<{ day: number; month: number; year: number; included: boolean; enable: boolean }> {
    const list = (this.testDetails?.student as any)?.[0]?.attendance ?? this.testDetails?.student?.attendance ?? [];
    return (list || []).map((a: AttendanceI & { day?: number }) => ({
      day: a.day ?? 0,
      month: a.month ?? 0,
      year: a.year ?? 0,
      included: !!a.included,
      enable: !!(a.enabled ?? a.enable),
    }));
  }

  /** Label for selected month/year (e.g. "Mar 2026"). */
  public get selectedMonthYearLabel(): string {
    return `${new Date(2000, this.selectedAttendanceMonth - 1, 1).toLocaleString("default", { month: "short" })} ${this.selectedAttendanceYear}`;
  }

  /** Selected month calendar: one entry per day with day number and whether the user attended. */
  public get currentMonthAttendanceDays(): Array<{ day: number; attended: boolean }> {
    const month = this.selectedAttendanceMonth;
    const year = this.selectedAttendanceYear;
    const daysInMonth = new Date(year, month, 0).getDate();

    const attendedSet = new Set(
      this.attendanceList.filter((a) => a.month === month && a.year === year && a.included && a.enable).map((a) => a.day)
    );

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return { day, attended: attendedSet.has(day) };
    });
  }

  public onAttendanceMonthYearChange(): void {
    this.loadTestOfClass();
  }
}
