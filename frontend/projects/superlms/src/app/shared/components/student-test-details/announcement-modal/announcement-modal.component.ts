/**
 * Announcement Modal Component
 *
 * @file          announcement-modal.component
 * @description   Modal for creating announcements
 * @author        John Mark Alicante
 * @since         2026 - 01 - 14
 */

//--- NG Modules
import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
//--- NG Zorro
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzInputModule } from "ng-zorro-antd/input";
import { Router } from "@angular/router";
import { AnnouncementI } from "@superlms/models/tests/test-of-class/test-of-class.endpoints.get.model";

@Component({
  selector: "slms-announcement-modal",
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
  templateUrl: "./announcement-modal.component.html",
  styleUrl: "./announcement-modal.component.less",
})
export class AnnouncementModalComponent {
  @Input({ alias: "class-id", required: true }) public classId: string;
  @Input({ alias: "student-id", required: true }) public studentId: string;
  @Input({ alias: "test-of-class-id", required: true }) public testOfClassId: string;
  @Output("submitted") public submitted: EventEmitter<void> = new EventEmitter();

  //--- Injectables
  private readonly apiService: ApiService = inject(ApiService);
  private readonly router: Router = inject(Router);

  //--- Forms
  public announcementFormGroup = new FormGroup({
    _id: new FormControl(null),
    title: new FormControl("", [Validators.required]),
    message: new FormControl("", [Validators.required]),
  });

  //--- Public
  public showModal: boolean = false;
  public announcement: AnnouncementI | null = null;

  /**
   * @name          toggle
   * @description   Toggles the visibility of the announcement modal
   * @returns       {void}
   */
  public toggle(announcement: AnnouncementI | null = null): void {
    this.showModal = !this.showModal;

    if (this.showModal) {
      this.announcement = announcement;
      this.announcementFormGroup.reset(this.announcement);
    }
  }

  /**
   * @name          onSubmit
   * @description   Called when the announcement modal is opened
   * @returns       {void}
   */
  public onSubmit(): void {
    if (this.announcementFormGroup.value._id) {
      // this.apiService.endPointsC.announcements.patch
      //   .updateById(this.apiService, this.announcementFormGroup.value._id, {
      //     title: this.announcementFormGroup.value.title,
      //     message: this.announcementFormGroup.value.message,
      //   })
      //   .then((res) => {
      //     if (res.success) {
      //       this.toggle();
      //       this.submitted.emit();
      //     }
      //   })
      //   .catch((error) => {
      //     console.error("Error updating announcement:", error);
      //   });
    } else {
      this.apiService.endPointsC.testOfClass.post
        .updateAnnouncement(this.apiService, {
          classId: this.classId,
          studentId: this.studentId,
          testOfClassId: this.testOfClassId,
          title: this.announcementFormGroup.value.title,
          message: this.announcementFormGroup.value.message,
        })
        .then((res) => {
          if (res.success) {
            this.toggle();
            this.submitted.emit();
          }
        })
        .catch((error) => {
          console.error("Error creating announcement:", error);
        });
    }
  }
}
