/**
 * Dashboard Component
 *
 * @file          dashboard.component
 * @description   Dashboard page for student
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Component, inject, OnInit } from "@angular/core";
import { Router } from "@angular/router";
//--- NG Zorro
import { NzBadgeModule } from "ng-zorro-antd/badge";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
import { AccountService } from "@superlms/services/account/account.service";
import { CourseI } from "@superlms/models/courses/courses.endpoints.datatypes";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { CourseListComponent } from "@superlms/shared/components/course-list/course-list.component";
import { ClassForCoursesI } from "@superlms/models/classes/classes.endpoints.datatypes";

@Component({
  selector: "slms-dashboard",
  imports: [
    //--- NG Zorro
    NzBadgeModule,
    ProfilePhotoDirective,
    CourseListComponent,
  ],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.less",
})
export class DashboardComponent implements OnInit {
  //--- Injectables
  public router: Router = inject(Router);
  private apiService: ApiService = inject(ApiService);
  public accountService: AccountService = inject(AccountService);

  public accountFields: any[] = [];

  public enrolledClasses: ClassForCoursesI[] = [];

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.accountFields = [
      { id: 1, name: "Email Address", value: this.accountService.account.emailAddresses.length > 0 ? this.accountService.account.emailAddresses.at(0) : "---" },
      {
        id: 2,
        name: "Phone",
        value:
          this.accountService.account.contactNumbers.length > 0
            ? this.accountService.account.contactNumbers.at(0)?.countryCallingCode + "" + this.accountService.account.contactNumbers.at(0)?.number
            : "---",
      },
      // { id: 3, name: "Email", value: this.accountService.account.emailAddresses.length > 0 ? this.accountService.account.emailAddresses.at(0) : "---" },
      { id: 4, name: "Address", value: this.accountService.account.address.city || "---" },
      { id: 5, name: "Date of Birth", value: this.accountService.account.birthDate || "---" },
      { id: 8, name: "Status", value: this.accountService.account.active ? "Active" : "Inactive" },
    ];

    this.apiService.endPointsC.testOfClass.get.assignedClassesInStudent(this.apiService).then((res) => {
      if (res) {
        this.enrolledClasses = res.data;
      }
    });
  }

  public selectCourse(selectedCourse: any): void {
    // Handle course selection
    this.router.navigateByUrl("/s/classes/" + selectedCourse._id);
  }
}
