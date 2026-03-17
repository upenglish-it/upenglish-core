/**
 * Student Test Details Component
 *
 * @file          student-test-details.component
 * @description   Renders the details of a student's test
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { ActivatedRoute } from "@angular/router";
import { Component, inject, OnInit } from "@angular/core";

//--- Components
import { StudentTestDetailsComponent } from "@superlms/shared/components/student-test-details/student-test-details.component";

@Component({
  selector: "slms-student-test-details-page",
  imports: [
    //--- Components
    StudentTestDetailsComponent,
  ],
  templateUrl: "./student-test-details.component.html",
  styleUrl: "./student-test-details.component.less",
})
export class StudentTestDetailsPage implements OnInit {
  //--- Injectables
  public activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  //--- Public
  public classId: string;
  public studentId: string;
  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.classId = this.activatedRoute.snapshot.paramMap.get("classId")!;
    this.studentId = this.activatedRoute.snapshot.paramMap.get("studentId")!;
  }
}
