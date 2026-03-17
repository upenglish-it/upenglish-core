/**
 * Course List Component
 *
 * @file          course-list.component
 * @description   Course list for student
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Component, inject, Input } from "@angular/core";
import { DatePipe, NgClass } from "@angular/common";
import { Router } from "@angular/router";
import { ClassForCoursesI } from "@superlms/models/classes/classes.endpoints.datatypes";
//--- NG Zorro
import { NzBadgeModule } from "ng-zorro-antd/badge";

@Component({
  selector: "slms-course-list",
  imports: [
    DatePipe,
    NgClass,
    //--- NG Zorro
    NzBadgeModule,
  ],
  templateUrl: "./course-list.component.html",
  styleUrl: "./course-list.component.less",
})
export class CourseListComponent {
  //--- Injectables
  public router: Router = inject(Router);

  //--- Input
  @Input({ alias: "redirection-path", required: true }) public redirectionPath: string;
  @Input({ alias: "classes", required: true }) public classes: ClassForCoursesI[] = [];

  /**
   * @name          selectClass
   * @description   Called when a class is selected
   * @returns       {void}
   */
  public selectClass(_class: ClassForCoursesI): void {
    this.router.navigateByUrl(`${this.redirectionPath}/${_class._id}`);
  }
}
