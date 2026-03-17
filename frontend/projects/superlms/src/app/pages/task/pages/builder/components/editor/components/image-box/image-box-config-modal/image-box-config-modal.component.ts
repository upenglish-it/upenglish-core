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
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
//--- PrimeNG
import { FileUploadModule } from "primeng/fileupload";
import { environment } from "@superlms-environment/environment";
@Component({
  selector: "slms-image-box-config-modal",
  imports: [
    //--- NG Modules
    ReactiveFormsModule,
    //--- NG Zorro
    NzInputModule,
    NzModalModule,
    NzButtonModule,
    NzSelectModule,
    NzInputNumberModule,
    //--- PrimeNG
    FileUploadModule,
  ],
  templateUrl: "./image-box-config-modal.component.html",
  styleUrl: "./image-box-config-modal.component.less",
})
export class ImageBoxConfigModalComponent implements OnInit {
  //--- Injectables
  private readonly apiService: ApiService = inject(ApiService);

  //--- Forms
  public imageBoxFormGroup = new FormGroup({
    elementId: new FormControl<string>("", [Validators.required]),
    src: new FormControl<string>("", [Validators.required]),
    // answerNumber: new FormControl<string>("", [Validators.required]),
    // points: new FormControl(0, [Validators.required]),
    // description: new FormControl(""),
  });

  //--- Public
  public showModal: boolean = false;
  public imageUploadState: "initial" | "uploading" = "initial";
  // public uploadFileUrl = `${environment.apiUrl}/file-manager`;

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
    // if (this.imageBoxFormGroup.valid) {
    this.showModal = false;
    const element = document.getElementById(this.imageBoxFormGroup.value.elementId);
    element.setAttribute("src", this.imageBoxFormGroup.value.src);
    //   element.setAttribute("answer-number", this.textboxFormGroup.value.answerNumber);
    //   element.setAttribute("points", this.textboxFormGroup.value.points.toString());

    // } else {
    //   console.log("Form is invalid");
    // }
    console.log("Submitted", this.imageBoxFormGroup.value);
  }

  // uploadedFiles: any[] = [];

  // onUpload(event: UploadEvent) {
  //   console.log("event", event);
  //   // for (let file of event.files) {
  //   //   this.uploadedFiles.push(file);
  //   // }
  //   this.showModal = false;
  //   const element = document.getElementById(this.textboxFormGroup.value.elementId);
  //   element.setAttribute("src", event.originalEvent.body.data[0].data.Location);
  //   this.uploadedFiles = [];
  // }

  /**
   * @name          onImageChange
   * @description   Handles image upload event
   * @param         {Event} event
   * @returns       {void}
   */
  public onImageChange(event: Event): void {
    const fileReader = new FileReader();
    const inputEvent = (event.target as HTMLInputElement)!;

    const file = inputEvent.files![0]!;
    fileReader.readAsDataURL(file);

    fileReader.onload = async () => {
      this.imageUploadState = "uploading";

      const formData: FormData = new FormData();
      formData.append("file", file);

      this.apiService.endPointsC.fileManager.post
        .upload(this.apiService, formData)
        .then((res) => {
          if (res.success) {
            //--- Update cover photos
            const element = document.getElementById(this.imageBoxFormGroup.value.elementId);
            const imageLink = res.data![0]!.data.cdn;
            this.imageBoxFormGroup.get("src").setValue(imageLink);
            // this.coversFormArray.push(new FormControl<string>(res.data![0]!.data.cdn));
            // const mediaFormGroup = MediaFormGroup();
            // mediaFormGroup.get("url")?.setValue(res.data![0]!.data.cdn);
            // mediaFormGroup.get("pin")?.setValue(false);
            // this.coversFormArray.push(mediaFormGroup);
          }
        })
        .finally(() => {
          this.imageUploadState = "initial";
        });
    };
  }
}

interface UploadEvent {
  originalEvent: any;
  files: File[];
}
