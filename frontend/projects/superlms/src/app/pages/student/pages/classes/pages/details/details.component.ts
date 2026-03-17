/**
 * Details Component
 *
 * @file          details.component
 * @description   Renders the details of a class
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { ActivatedRoute } from "@angular/router";
import { Component, inject, OnInit } from "@angular/core";
//--- Services
import { AccountService } from "@superlms/services/account/account.service";

//--- Components
import { StudentTestDetailsComponent } from "@superlms/shared/components/student-test-details/student-test-details.component";

@Component({
  selector: "slms-details",
  imports: [
    //--- Components
    StudentTestDetailsComponent,
  ],
  templateUrl: "./details.component.html",
  styleUrl: "./details.component.less",
})
export class DetailsComponent implements OnInit {
  //--- Injectables
  public accountService: AccountService = inject(AccountService);
  public activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  //--- Public
  public classId: string;

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.classId = this.activatedRoute.snapshot.paramMap.get("classId")!;
  }
}
