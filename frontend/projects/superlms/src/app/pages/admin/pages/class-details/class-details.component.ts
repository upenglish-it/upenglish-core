/**
 * Class Details Component
 *
 * @file          class-details.component
 * @description   Dashboard page for student
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { ActivatedRoute, Router } from "@angular/router";
import { Component, inject, OnInit } from "@angular/core";
//--- Components
import { TestClassManagerComponent } from "@superlms/shared/components/test-class-manager/test-class-manager.component";

@Component({
  selector: "slms-class-details",
  imports: [
    //--- NG Modules
    //--- Components
    TestClassManagerComponent,
  ],
  templateUrl: "./class-details.component.html",
  styleUrl: "./class-details.component.less",
})
export class ClassDetailsComponent implements OnInit {
  //--- Injectables
  public router: Router = inject(Router);
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
