/**
 * Tests Component
 *
 * @file          tests.component
 * @description   Tests page for admin
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Component, inject, OnInit } from "@angular/core";
import { DatePipe } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
//--- Interfaces
import { TestI } from "../../../task/pages/builder/form-group/test.form-group";
//--- Components
import { CreateTaskModalComponent } from "@superlms/shared/components/create-task-modal/create-task-modal.component";
//--- NG Zorro
import { NzBadgeModule } from "ng-zorro-antd/badge";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzModalService } from "ng-zorro-antd/modal";
import { NzSpinModule } from "ng-zorro-antd/spin";

@Component({
  selector: "slms-templates",
  imports: [
    //--- NG Modules
    RouterLink,
    DatePipe,
    //--- NG Zorro
    NzBadgeModule,
    NzButtonModule,
    NzSpinModule,
    //--- Components
    CreateTaskModalComponent,
  ],
  templateUrl: "./templates.component.html",
  styleUrl: "./templates.component.less",
})
export class TemplatesComponent implements OnInit {
  //--- Injectables
  public router: Router = inject(Router);
  private apiService: ApiService = inject(ApiService);
  private nzModalService: NzModalService = inject(NzModalService);
  public nzNotificationService: NzNotificationService = inject(NzNotificationService);

  //--- Publics
  public tests: TestI[] = [];
  public isLoading = false;
  public isLoadingMore = false;
  public hasMore = false;

  //--- Privates
  private readonly limit = 15;
  private currentPage = 1;

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.currentPage = 1;
    this.tests = [];
    this.isLoading = true;
    this.fetchTests();
  }

  /**
   * @name          loadMore
   * @description   Loads the next page of templates and appends them to the list
   * @returns       {void}
   */
  public loadMore(): void {
    this.currentPage++;
    this.isLoadingMore = true;
    this.fetchTests(true);
  }

  /**
   * @name          fetchTests
   * @description   Fetches templates for the current page
   * @param         {boolean} append - appends results to existing list when true
   * @returns       {void}
   */
  private fetchTests(append = false): void {
    this.apiService.endPointsC.tasks.get
      .getAll(this.apiService, { page: this.currentPage, limit: this.limit })
      .then((res) => {
        if (res.success && res.data?.items) {
          this.tests = append ? [...this.tests, ...res.data.items] : res.data.items;
          this.hasMore = res.data.items.length === this.limit;
        } else {
          this.hasMore = false;
        }
      })
      .finally(() => {
        this.isLoading = false;
        this.isLoadingMore = false;
      });
  }

  /**
   * @name          selectTest
   * @description   Called when a test is selected
   * @returns       {void}
   */
  public selectTest(test: TestI): void {
    this.router.navigateByUrl(`/tasks/${test._id}/builder`);
  }

  /**
   * @name          deleteTest
   * @description   Called when a test is deleted
   * @returns       {void}
   */
  public deleteTest(testId: string): void {
    this.nzModalService.confirm({
      nzTitle: "Do you want to delete this template?",
      nzContent: "This action cannot be undone.",
      nzOkText: "Delete",
      nzOkDanger: true,
      nzCancelText: "Cancel",
      nzOnOk: () => {
        this.apiService.endPointsC.tasks.delete.deleteById(this.apiService, testId).then((res) => {
          if (res.success) {
            this.nzNotificationService.create("success", "Test deleted successfully", res.message, { nzPlacement: "bottomRight" });
            this.ngOnInit();
          }
        });
      },
    });
  }
}
