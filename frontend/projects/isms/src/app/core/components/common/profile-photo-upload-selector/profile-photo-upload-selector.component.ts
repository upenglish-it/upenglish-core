import { NgClass, NgIf } from "@angular/common";
import { Component, EventEmitter, Input, Output, ViewEncapsulation } from "@angular/core";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { ImageCroppedEvent, ImageCropperModule } from "ngx-image-cropper";

@Component({
  selector: "isms-profile-photo-upload-selector",
  templateUrl: "./profile-photo-upload-selector.component.html",
  styleUrls: ["./profile-photo-upload-selector.component.scss"],
  encapsulation: ViewEncapsulation.None,
  imports: [NgClass, NgIf, ImageCropperModule, NzPopconfirmModule, NzIconModule, NzModalModule, NzButtonModule],
})
export class ProfilePhotoUploadSelectorComponent {
  @Output("on-upload-file") onUploadFile: EventEmitter<IFileUploadSelector> = new EventEmitter<IFileUploadSelector>();

  @Output("on-remove-file") onChangeRemoveFile: EventEmitter<number> = new EventEmitter<number>();

  @Input("element-id") elementId: string;
  @Input("accepted-file-type") acceptedFileType: string;
  @Input("profile-photo") profilePhoto: string;
  @Input("label") label: string;
  @Input("sub-label") subLabel: string;
  public fileType: string;
  public fileSource: string;
  public fileName: string;

  public imagesList = [0, 0, 0];

  public cropperImageChangedEvent: any;

  public selectedPreviewFile: string | boolean;
  public previewModal: boolean;
  public editModal: boolean;

  public onFileChange(event: Event): void {
    this.cropperImageChangedEvent = event;

    const fileReader = new FileReader();
    const inputEvent = event.target as HTMLInputElement;

    fileReader.readAsDataURL(inputEvent.files[0]);

    const { type, name, size } = inputEvent.files[0];
    console.log(size / 1024 / 1024 + "MB");

    this.fileType = type;
    this.fileName = name;

    fileReader.onload = () => {
      const base64FileSource = fileReader.result as string;
      this.onUploadFile.emit({
        value: base64FileSource,
        extension: type,
      });
    };
  }

  public imageCropped(croppedImageValue: ImageCroppedEvent): void {
    // console.log(croppedImageValue, croppedImageValue.base64);

    const fileReader = new FileReader();
    fileReader.readAsDataURL(croppedImageValue.blob);

    fileReader.onload = (e) => {
      // console.log(e.target);
      const base64FileSource = fileReader.result as string;
      this.onUploadFile.emit({
        value: base64FileSource,
        extension: base64FileSource.substring("data:image/".length, base64FileSource.indexOf(";base64")),
      });

      console.log("base64FileSource", base64FileSource);
    };

    // this.files[this.selectedIndex].value = croppedImageValue.base64;
    // this.onUploadFile.emit({
    //   value: croppedImageValue.base64,
    //   extension: croppedImageValue.base64.substring("data:image/".length, croppedImageValue.base64.indexOf(";base64"))
    // });
  }

  public onClickRemoveFile(index: number): void {
    this.onChangeRemoveFile.emit(index);
  }
}

export interface IFileUploadSelector {
  value: string;
  extension?: string;
  fileName?: string;
  size?: number;
  selectedIndex?: number;
}
