/**
 * Navigation Header Component
 *
 * @file          navigation-header.component
 * @description   Renders the navigation header
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Component, inject, Input, OnInit } from "@angular/core";
import { NgClass, NgIf } from "@angular/common";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { AccountService } from "@superlms/services/account/account.service";
//--- NG Zorro
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzBadgeModule } from "ng-zorro-antd/badge";
import { StudentsService } from "@superlms/services/student/students.service";

@Component({
  selector: "slms-navigation-header",
  imports: [
    //--- NG Modules
    NgClass,
    NgIf,
    RouterLink,
    RouterLinkActive,
    //--- NG Zorro
    NzDropDownModule,
    NzBadgeModule,
  ],
  templateUrl: "./navigation-header.component.html",
  styleUrl: "./navigation-header.component.less",
})
export class NavigationHeaderComponent implements OnInit {
  @Input({ alias: "view", required: true }) public view: "admin" | "student" | "teacher";

  //--- Injectables
  public accountService: AccountService = inject(AccountService);
  public studentService: StudentsService = inject(StudentsService);
  public navigations: { id: number; name: string; link: string; notifCount?: number }[] = [];
  public isMenuOpen = false;
  public pendingReviews: number = 0;

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.loadData();

    if (this.view === "admin") {
      this.navigations = [
        {
          id: 1,
          name: "Templates",
          link: "/a/templates",
        },
        {
          id: 2,
          name: "Courses",
          link: "/a/courses",
        },
        {
          id: 3,
          name: "Classes",
          link: "/a/classes",
        },
        {
          id: 4,
          name: "Settings",
          link: "/a/settings",
        },
      ];
    }

    if (this.view === "student") {
      this.navigations = [
        {
          id: 1,
          name: "Dashboard",
          link: "/s/dashboard",
        },
        {
          id: 2,
          name: "My Classes",
          link: "/s/classes",
        },
      ];
    }

    if (this.view === "teacher") {
      this.navigations = [
        {
          id: 1,
          name: "Dashboard",
          link: "/t/dashboard",
        },
        {
          id: 2,
          name: "My Classes",
          link: "/t/courses",
        },
        {
          id: 3,
          name: "My Students",
          link: "/t/classes",
          notifCount: this.pendingReviews,
        },
      ];
    }
  }

  public toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  public closeMenu(): void {
    this.isMenuOpen = false;
  }

  public loadData(): void {
    this.studentService.studentPendingReview().then((res) => {
      this.pendingReviews = res.data.totalPendingReviews || 0;
      this.updateTeacherNavNotifCount();
    });
  }

  private updateTeacherNavNotifCount(): void {
    if (this.view === "teacher") {
      const myStudentsNav = this.navigations.find((nav) => nav.id === 3);
      if (myStudentsNav) {
        myStudentsNav.notifCount = this.pendingReviews;
      }
    }
  }
}
