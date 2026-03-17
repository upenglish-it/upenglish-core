/**
 * Create Task Modal Component
 *
 * @file          create-task-modal.component
 * @description   Modal for creating tasks
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Component, EventEmitter, inject, OnInit, Output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
//--- Ulidx
import { ulid } from "ulidx";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
//--- NG Zorro
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzInputModule } from "ng-zorro-antd/input";
import { Router } from "@angular/router";
import { CourseI } from "@superlms/models/courses/courses.endpoints.datatypes";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";

@Component({
  selector: "slms-answer-box-config-modal",
  imports: [
    //--- NG Modules
    ReactiveFormsModule,
    //--- NG Zorro
    NzInputModule,
    NzModalModule,
    NzButtonModule,
    NzSelectModule,
    NzInputNumberModule,
  ],
  templateUrl: "./answer-box-config-modal.component.html",
  styleUrl: "./answer-box-config-modal.component.less",
})
export class AnswerBoxConfigModalComponent implements OnInit {
  @Output("on-submitted") private readonly onSubmitte: EventEmitter<void> = new EventEmitter<void>();

  //--- Injectables
  private readonly apiService: ApiService = inject(ApiService);
  private readonly router: Router = inject(Router);

  //--- Forms
  public textboxFormGroup = new FormGroup({
    elementId: new FormControl<string>("", [Validators.required]),
    answerNumber: new FormControl<string>("", [Validators.required]),
    points: new FormControl(0, [Validators.required]),
    description: new FormControl(""),
  });

  //--- Public
  public showModal: boolean = false;

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {}

  /**
   * @name          toggle
   * @description   Toggles the visibility of the create task modal
   * @returns       {void}
   */
  public toggle(): void {
    this.showModal = !this.showModal;
  }

  /**
   * @name          submit
   * @description   Submits the form data
   * @returns       {void}
   */
  public submit(): void {
    if (this.textboxFormGroup.valid) {
      this.showModal = false;
      const element = document.getElementById(this.textboxFormGroup.value.elementId);
      element.setAttribute("answer-number", this.textboxFormGroup.value.answerNumber);
      element.setAttribute("points", this.textboxFormGroup.value.points.toString());
    } else {
      console.log("Form is invalid");
    }
  }
}
