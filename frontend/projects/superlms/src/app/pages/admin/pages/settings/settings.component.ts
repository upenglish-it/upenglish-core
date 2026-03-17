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
import { Router, RouterLink } from "@angular/router";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
//--- Interfaces
import { TestI } from "../../../task/pages/builder/form-group/test.form-group";
import { PromptI } from "@superlms/models/prompts/prompts.endpoints.datatypes";
//--- NG Zorro
import { NzBadgeModule } from "ng-zorro-antd/badge";
import { NzButtonModule } from "ng-zorro-antd/button";
import { ReactiveFormsModule } from "@angular/forms";
import { NzInputModule } from "ng-zorro-antd/input";
import { CreatePromptsModalComponent } from "@superlms/shared/components/create-prompts-modal/create-prompts-modal.component";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzNotificationService } from "ng-zorro-antd/notification";

@Component({
  selector: "slms-settings",
  imports: [
    //--- NG Modules
    ReactiveFormsModule,
    //--- NG Zorro
    NzTagModule,
    NzBadgeModule,
    NzInputModule,
    NzButtonModule,
    //--- Components
    CreatePromptsModalComponent,
  ],
  templateUrl: "./settings.component.html",
  styleUrl: "./settings.component.less",
})
export class SettingsComponent implements OnInit {
  //--- Injectables
  public router: Router = inject(Router);
  private apiService: ApiService = inject(ApiService);
  private nzNotificationService: NzNotificationService = inject(NzNotificationService);

  //--- Public
  public prompts: PromptI[] = [];

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.apiService.endPointsC.prompts.get.list(this.apiService).then((res) => {
      if (res.success) {
        this.prompts = res.data;
      }
    });
  }

  /**
   * @name          deletePrompt
   * @description   Called when a prompt is deleted
   * @returns       {void}
   */
  public deletePrompt(promptId: string): void {
    this.apiService.endPointsC.prompts.delete.deleteById(this.apiService, promptId).then((res) => {
      if (res.success) {
        this.nzNotificationService.create("success", "Prompt deleted successfully", res.message, { nzPlacement: "bottomRight" });
      }
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
}
