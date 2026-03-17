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
import { ClassForCoursesI } from "@superlms/models/classes/classes.endpoints.datatypes";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
import { CourseListComponent } from "@superlms/shared/components/course-list/course-list.component";
//--- NG Zorro
import { NzBadgeModule } from "ng-zorro-antd/badge";

@Component({
  selector: "slms-courses",
  imports: [
    //--- NG Zorro
    NzBadgeModule,
    //--- Components
    CourseListComponent,
  ],
  templateUrl: "./courses.component.html",
  styleUrl: "./courses.component.less",
})
export class CoursesComponent implements OnInit {
  //--- Injectables
  public router: Router = inject(Router);
  private apiService: ApiService = inject(ApiService);

  //--- Publics
  public classes: ClassForCoursesI[] = [];

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.apiService.endPointsC.classes.get.adminClassForCourses(this.apiService).then((res) => {
      if (res) {
        this.classes = res.data;
      }
    });

    this.apiService.endPointsC.tasks.get.getAll(this.apiService).then((res) => {
      if (res.success) {
        //asdas asd
      }
    });
  }
}
