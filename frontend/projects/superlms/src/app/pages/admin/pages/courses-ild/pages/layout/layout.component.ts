/**
 * Layout Component
 *
 * @file          layout.component
 * @description   Content wrapper and renders the page for dynamic content.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

import { ActivatedRoute } from "@angular/router";
import { Component, inject, OnInit, ViewEncapsulation } from "@angular/core";
//--- Components
import { TestCourseManagerComponent } from "@superlms/shared/components/test-course-manager/test-course-manager.component";

@Component({
  selector: "test-details-layout",
  templateUrl: "./layout.component.html",
  styleUrls: ["./layout.component.scss"],
  encapsulation: ViewEncapsulation.None,
  imports: [
    //--- Components
    TestCourseManagerComponent,
  ],
})
export class TestDetailsLayoutComponent implements OnInit {
  //--- Injectables
  public activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  //--- Public
  public classId: string | null = null;

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.classId = this.activatedRoute.snapshot.paramMap?.get("classId");
  }
}
