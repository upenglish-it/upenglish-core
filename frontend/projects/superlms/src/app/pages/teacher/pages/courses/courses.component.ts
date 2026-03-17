/**
 * Dashboard Component
 *
 * @file          dashboard.component
 * @description   Dashboard page for student
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Component, inject } from "@angular/core";
//--- Interfaces
import { ClassForCoursesI } from "@superlms/models/classes/classes.endpoints.datatypes";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
//--- NG Zorro
import { NzBadgeModule } from "ng-zorro-antd/badge";
//--- Components
import { CourseListComponent } from "@superlms/shared/components/course-list/course-list.component";

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
export class CoursesComponent {
  //--- Injectables
  private apiService: ApiService = inject(ApiService);

  //--- Publics
  public assignedClasses: ClassForCoursesI[] = [];

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.apiService.endPointsC.classes.get.teacherAssignedClassForMyCourses(this.apiService).then((res) => {
      if (res) {
        this.assignedClasses = res.data;
      }
    });
  }
}
