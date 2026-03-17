/**
 * Create Task Modal Component
 *
 * @file          create-task-modal.component
 * @description   Modal for creating tasks
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Component, inject, OnInit } from "@angular/core";
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
import { CourseI } from "@superlms/models/courses/courses.endpoints.datatypes";

@Component({
  selector: "slms-create-task-modal",
  imports: [
    //--- NG Modules
    ReactiveFormsModule,
    //--- NG Zorro
    NzInputModule,
    NzModalModule,
    NzButtonModule,
    NzSelectModule,
  ],
  templateUrl: "./create-task-modal.component.html",
  styleUrl: "./create-task-modal.component.less",
})
export class CreateTaskModalComponent implements OnInit {
  //--- Injectables
  private readonly apiService: ApiService = inject(ApiService);
  private readonly router: Router = inject(Router);

  //--- Forms
  public taskFormGroup = new FormGroup({
    _id: new FormControl(),
    name: new FormControl(),
    type: new FormControl("reading"),
  });

  //--- Public
  public showModal: boolean = false;
  public taskTypes: { id: string; label: string; value: string }[] = [
    { id: ulid(), label: "Reading", value: "reading" },
    { id: ulid(), label: "Listening", value: "listening" },
    { id: ulid(), label: "Writing", value: "writing" },
    { id: ulid(), label: "Speaking", value: "speaking" },
  ];
  // public courses: CourseI[] = [];

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    // this.apiService.endPointsC.courses.get.getAll(this.apiService, { limit: 1000 }).then((res) => {
    //   if (res) {
    //     this.courses = res.data;
    //   }
    // });
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
    this.apiService.endPointsC.tasks.post
      .create(this.apiService, { name: this.taskFormGroup.value.name, type: this.taskFormGroup.value.type })
      .then((res) => {
        if (res) {
          this.router.navigate(["task", res.data._id, "builder"], {
            queryParams: {
              backRedirectUrl: this.router.url,
              type: "template",
              mode: "editing",
              action: "builder-editing",
            },
          });
        }
      })
      .catch((error) => {
        console.error("Error creating task:", error);
      });
  }
}
