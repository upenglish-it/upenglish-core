/**
 * Dashboard Component
 *
 * @file          dashboard.component
 * @description   Dashboard page for student
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { DatePipe } from "@angular/common";
import { Component, inject, OnInit } from "@angular/core";

import { ClassForCoursesI } from "@superlms/models/classes/classes.endpoints.datatypes";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
//--- NG Zorro
import { NzBadgeModule } from "ng-zorro-antd/badge";
import { NzSpinModule } from "ng-zorro-antd/spin";
//--- Types
import { CourseI } from "@superlms/models/courses/courses.endpoints.datatypes";

@Component({
  selector: "slms-courses",
  imports: [
    DatePipe,
    //--- NG Zorro
    NzBadgeModule,
    NzSpinModule,
  ],
  templateUrl: "./courses.component.html",
  styleUrl: "./courses.component.less",
})
export class CoursesComponent implements OnInit {
  //--- Injectables
  private apiService: ApiService = inject(ApiService);

  //--- Publics
  public assignedClasses: ClassForCoursesI[] = [];
  public classes: CourseI[] = [];
  public isLoading = false;

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.isLoading = true;

    this.apiService.endPointsC.courses.get
      .getAll(this.apiService, { limit: 100 })
      .then((res) => {
        if (res) {
          this.classes = res.data;
        }
      })
      .finally(() => {
        this.isLoading = false;
      });
  }
}
