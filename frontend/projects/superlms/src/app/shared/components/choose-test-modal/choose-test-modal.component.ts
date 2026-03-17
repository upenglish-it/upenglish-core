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
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
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
import { TestI } from "../../../pages/task/pages/builder/form-group/test.form-group";
import { CreateTaskModalComponent } from "../create-task-modal/create-task-modal.component";

@Component({
  selector: "slms-choose-test-modal",
  imports: [
    //--- NG Modules
    ReactiveFormsModule,
    //--- NG Zorro
    NzInputModule,
    NzModalModule,
    NzButtonModule,
    NzSelectModule,

    //--- Components
    CreateTaskModalComponent,
  ],
  templateUrl: "./choose-test-modal.component.html",
  styleUrl: "./choose-test-modal.component.less",
})
export class ChooseTestModalComponent implements OnInit {
  @Output("submitted") public submitted: EventEmitter<void> = new EventEmitter();

  //--- Injectables
  private readonly apiService: ApiService = inject(ApiService);
  private readonly router: Router = inject(Router);

  //--- Forms
  public testFormGroup = new FormGroup({
    testsOfClassId: new FormControl(),
    classId: new FormControl(),
    periodId: new FormControl(),
    sectionId: new FormControl(),
    testId: new FormControl(),
  });

  //--- Public
  public showModal: boolean = false;
  public tests: TestI[] = [];

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.apiService.endPointsC.tasks.get.getAll(this.apiService).then((res) => {
      if (res) {
        this.tests = res.data.items;
      }
    });
  }

  /**
   * @name          toggle
   * @description   Toggles the visibility of the create task modal
   * @returns       {void}
   */
  public toggle(): void {
    this.showModal = !this.showModal;
  }

  /**
   * @name          onCreate
   * @description   Called when the create task modal is opened
   * @returns       {void}
   */
  public onCreate(): void {
    this.apiService.endPointsC.testOfClass.post
      .addTest(this.apiService, {
        testOfClassId: this.testFormGroup.value.testsOfClassId,
        classId: this.testFormGroup.value.classId,
        periodId: this.testFormGroup.value.periodId,
        sectionId: this.testFormGroup.value.sectionId,
        testId: this.testFormGroup.value.testId,
      })
      .then((res) => {
        if (res.success) {
          this.toggle();
          this.submitted.emit();
        }
      })
      .catch((error) => {
        console.error("Error creating task:", error);
      });
  }
}
