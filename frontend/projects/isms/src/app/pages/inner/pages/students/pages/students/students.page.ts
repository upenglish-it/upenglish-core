import { Component } from "@angular/core";
import { Animations } from "@isms-core/constants";
import { NgIf } from "@angular/common";
import { ActivatedRoute } from "@angular/router";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { StudentListingComponent } from "@isms-core/components/students/student-listing/student-listing.component";
import { AttendanceListingComponent } from "@isms-core/components/students/attendance-listing/attendance-listing.component";
import { TuitionListingComponent } from "@isms-core/components/students/tuition-listing/tuition-listing.component";
import { ISegmentSelector } from "@isms-core/interfaces";
import { AccountStore } from "@isms-core/ngrx";

@Component({
  templateUrl: "./students.page.html",
  animations: [Animations.down, Animations.default],
  imports: [NgIf, SegmentedSelectorComponent, StudentListingComponent, AttendanceListingComponent, TuitionListingComponent],
})
export class StudentsPage {
  public segmentOptions: Array<ISegmentSelector> = [
    {
      label: "Students",
      description: "Your created students",
      icon: "ph-duotone ph-users-four",
      disable: false,
      type: "students",
    },
    {
      label: "Attendance",
      description: "Student attendance",
      icon: "ph-duotone ph-list-checks",
      disable: false,
      type: "tuition-attendance",
    },
    {
      label: "Tuition Payment/Enrollment",
      description: "Student pay tuition",
      icon: "ph-duotone ph-money",
      disable: false,
      type: "tuition-attendance",
    },
  ];
  public filteredSegmentOptions: Array<ISegmentSelector> = this.segmentOptions;

  public segmentIndex = 0;

  public onChangeSegmentSelector(index: number): void {
    console.log("index", index);
    this.segmentIndex = index;
  }

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly accountStore: AccountStore
  ) {
    this.segmentIndex = parseInt((this.activatedRoute.snapshot.queryParams as any)?.tab || 0);

    if (this.accountStore.account.role === "teacher") {
      this.segmentOptions[0].disable = true;
      this.segmentOptions[1].disable = false;
      this.segmentOptions[2].disable = true;

      this.segmentIndex = 1;
    }
  }
}
