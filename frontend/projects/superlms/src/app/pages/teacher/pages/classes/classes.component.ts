/**
 * Classes Component
 *
 * @file          classes.component
 * @description   Dashboard page for student
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { RouterLink } from "@angular/router";
import { Component, inject } from "@angular/core";
//--- Interfaces
import { ClassForCoursesI } from "@superlms/models/classes/classes.endpoints.datatypes";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
//--- Components
import { ClassListComponent } from "@superlms/shared/components/class-list/class-list.component";

@Component({
  selector: "slms-classes",
  imports: [
    //--- NG Modules
    RouterLink,
    //--- Components
    ClassListComponent,
  ],
  templateUrl: "./classes.component.html",
  styleUrl: "./classes.component.less",
})
export class ClassesComponent {
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
