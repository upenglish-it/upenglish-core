/**
 * Test Class Manager Component
 *
 * @file          test-class-manager.component
 * @description   Test Class Manager for student
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { JsonPipe } from "@angular/common";
import { Component, inject, Input, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { IAccount } from "@isms-core/interfaces";
import { ComposedRRule } from "@isms-core/utils";
import { TestOfClass } from "@superlms/models/tests/test-of-class/test-of-class.endpoints.datatypes";
import { GetTestOfClassResponseI } from "@superlms/models/tests/test-of-class/test-of-class.endpoints.get.model";
import { AccountService } from "@superlms/services/account/account.service";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
import { ChooseTestModalComponent } from "@superlms/shared/components/choose-test-modal/choose-test-modal.component";
//--- NG Zorro
import { NzBadgeModule } from "ng-zorro-antd/badge";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzListModule } from "ng-zorro-antd/list";
import { NzMessageService } from "ng-zorro-antd/message";
import { NzModalService } from "ng-zorro-antd/modal";
import { NzTagModule } from "ng-zorro-antd/tag";

@Component({
  selector: "slms-test-class-manager",
  imports: [
    //--- NG Modules
    RouterLink,
    FormsModule,
    //--- NG Zorro
    NzInputModule,
    //--- Directives
    ProfilePhotoDirective,
  ],
  templateUrl: "./test-class-manager.component.html",
  styleUrl: "./test-class-manager.component.less",
})
export class TestClassManagerComponent {
  //--- Injectables
  private router: Router = inject(Router);
  private apiService: ApiService = inject(ApiService);
  public accountService: AccountService = inject(AccountService);

  //--- Input
  @Input({ alias: "back-route", required: true }) public backRoute: string;
  @Input({ alias: "back-title", required: true }) public backTitle: string;
  @Input({ alias: "class-id", required: true }) public classId: string;

  //--- Public
  public testOfClass: GetTestOfClassResponseI | null = null;

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.loadTestOfClass();
  }

  /**
   * @name          loadTestOfClass
   * @description   Loads the test of class data
   * @returns       {void}
   */
  public loadTestOfClass(): void {
    this.apiService.endPointsC.testOfClass.get.getTestOfClass(this.apiService, { classId: this.classId }).then((res) => {
      if (res.success) {
        this.testOfClass = res.data;

        // const sched = ComposedRRule({
        //   ...this.testOfClass.scheduleAndStaff.schedule,

        //   fromDate: _toDate,
        //   fromTime: _fromTime,
        //   toDate: new Date(recurrenceEndDate), //DateTime.fromISO(recurrenceEndDate as any).toJSDate(),
        //   toTime: _toTime,
        // });

        // console.log("RRULE:", sched);
      }
    });
  }

  /**
   * @name          selectStudent
   * @description   Selects a student from the list
   * @param         {IAccount} account   The selected student
   * @returns       {void}
   */
  public selectStudent(account: IAccount): void {
    this.router.navigate(["/t/student-test-detail", this.classId, account._id]);
  }
}
