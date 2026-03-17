/**
 * Add Red Flag Modal Component
 *
 * @file          add-red-flag-modal.component
 * @description   Modal for adding red flags
 * @author        John Mark Alicante
 * @since         2026 - 01 - 14
 */

//--- NG Modules
import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
//--- NG Zorro
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzInputModule } from "ng-zorro-antd/input";

@Component({
  selector: "slms-add-red-flag-modal",
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
  templateUrl: "./add-red-flag-modal.component.html",
  styleUrl: "./add-red-flag-modal.component.less",
})
export class AddRedFlagModalComponent implements OnInit {
  @Input({ alias: "class-id", required: true }) public classId: string;
  @Input({ alias: "student-id", required: true }) public studentId: string;
  @Output("submitted") public submitted: EventEmitter<void> = new EventEmitter();

  //--- Injectables
  private readonly apiService: ApiService = inject(ApiService);

  //--- Forms
  public redFlagFormGroup = new FormGroup({
    _id: new FormControl(null),
    message: new FormControl("", [Validators.required]),
  });

  //--- Public
  public showModal: boolean = false;
  public redFlags: any[] = [];

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.redFlags = [];
  }

  /**
   * @name          toggle
   * @description   Toggles the visibility of the add red flag modal
   * @returns       {void}
   */
  public toggle(redFlag: any | null = null): void {
    this.redFlagFormGroup.reset(redFlag);

    this.showModal = !this.showModal;
  }

  /**
   * @name          onSubmit
   * @description   Called when the add red flag modal is opened
   * @returns       {void}
   */
  public onSubmit(): void {
    if (this.redFlagFormGroup.value._id) {
      // this.apiService.endPointsC.testOfClass.patch
      //   .updateRedFlag(this.apiService, this.redFlagFormGroup.value._id, {
      //     classId: this.redFlagFormGroup.value.classId,
      //     studentId: this.redFlagFormGroup.value.studentId,
      //     message: this.redFlagFormGroup.value.message,
      //   })
      //   .then((res) => {
      //     if (res.success) {
      //       this.toggle();
      //       this.submitted.emit();
      //     }
      //   })
      //   .catch((error) => {
      //     console.error("Error updating red flag:", error);
      //   });
    } else {
      this.apiService.endPointsC.testOfClass.post
        .addRedFlag(this.apiService, {
          classId: this.classId,
          studentId: this.studentId,
          message: this.redFlagFormGroup.value.message,
        })
        .then((res) => {
          if (res.success) {
            this.toggle();
            this.submitted.emit();
          }
        })
        .catch((error) => {
          console.error("Error creating red flag:", error);
        });
    }
  }
}
