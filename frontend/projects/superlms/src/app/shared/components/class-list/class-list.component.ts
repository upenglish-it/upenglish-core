/**
 * Class List Component
 *
 * @file          class-list.component
 * @description   Class list for student
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Component, inject, Input } from "@angular/core";
import { NgClass } from "@angular/common";
import { Router } from "@angular/router";
import { ClassForCoursesI } from "@superlms/models/classes/classes.endpoints.datatypes";
//--- NG Zorro
import { NzBadgeModule } from "ng-zorro-antd/badge";

@Component({
  selector: "slms-class-list",
  imports: [
    NgClass,
    //--- NG Zorro
    NzBadgeModule,
  ],
  templateUrl: "./class-list.component.html",
  styleUrl: "./class-list.component.less",
})
export class ClassListComponent {
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
