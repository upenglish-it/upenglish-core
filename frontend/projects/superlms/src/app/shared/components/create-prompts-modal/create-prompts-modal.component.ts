/**
 * Create Prompts Modal Component
 *
 * @file          create-prompts-modal.component
 * @description   Modal for creating prompts
 * @author        John Mark Alicante
 * @since         2026 - 01 - 14
 */

//--- NG Modules
import { Component, EventEmitter, inject, OnInit, Output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
//--- NG Zorro
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzInputModule } from "ng-zorro-antd/input";
import { Router } from "@angular/router";
import { PromptI } from "@superlms/models/prompts/prompts.endpoints.datatypes";
import { isEmpty } from "lodash";

@Component({
  selector: "slms-create-prompts-modal",
  imports: [
    //--- NG Modules
    ReactiveFormsModule,
    //--- NG Zorro
    NzInputModule,
    NzModalModule,
    NzButtonModule,
    NzSelectModule,

    //--- Components
  ],
  templateUrl: "./create-prompts-modal.component.html",
  styleUrl: "./create-prompts-modal.component.less",
})
export class CreatePromptsModalComponent implements OnInit {
  @Output("submitted") public submitted: EventEmitter<void> = new EventEmitter();

  //--- Injectables
  private readonly apiService: ApiService = inject(ApiService);
  private readonly router: Router = inject(Router);

  //--- Forms
  public promptFormGroup = new FormGroup({
    _id: new FormControl(null),
    name: new FormControl("", [Validators.required]),
    provider: new FormControl("", [Validators.required]),
    model: new FormControl("", [Validators.required]),
    apiKey: new FormControl("", [Validators.required]),
    message: new FormControl("", [Validators.required]),
  });

  //--- Public
  public showModal: boolean = false;
  public prompts: PromptI[] = [];

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.apiService.endPointsC.prompts.get.list(this.apiService).then((res) => {
      if (res) {
        this.prompts = res.data;
      }
    });
  }

  /**
   * @name          toggle
   * @description   Toggles the visibility of the create prompts modal
   * @returns       {void}
   */
  public toggle(prompt: PromptI | null = null): void {
    this.promptFormGroup.reset(prompt);

    this.showModal = !this.showModal;
  }

  /**
   * @name          onSubmit
   * @description   Called when the create prompts modal is opened
   * @returns       {void}
   */
  public onSubmit(): void {
    if (this.promptFormGroup.value._id) {
      this.apiService.endPointsC.prompts.patch
        .updateById(this.apiService, this.promptFormGroup.value._id, {
          name: this.promptFormGroup.value.name,
          provider: this.promptFormGroup.value.provider,
          model: this.promptFormGroup.value.model,
          apiKey: this.promptFormGroup.value.apiKey,
          message: this.promptFormGroup.value.message,
        })
        .then((res) => {
          if (res.success) {
            this.toggle();
            this.submitted.emit();
          }
        })
        .catch((error) => {
          console.error("Error updating prompt:", error);
        });
    } else {
      this.apiService.endPointsC.prompts.post
        .create(this.apiService, {
          name: this.promptFormGroup.value.name,
          provider: this.promptFormGroup.value.provider,
          model: this.promptFormGroup.value.model,
          apiKey: this.promptFormGroup.value.apiKey,
          message: this.promptFormGroup.value.message,
        })
        .then((res) => {
          if (res.success) {
            this.toggle();
            this.submitted.emit();
          }
        })
        .catch((error) => {
          console.error("Error creating prompt:", error);
        });
    }
  }
}
