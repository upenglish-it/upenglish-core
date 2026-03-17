import { Component, EventEmitter, Input, Output } from "@angular/core";
import { IFileUploadSelector } from "../profile-photo-upload-selector/profile-photo-upload-selector.component";
import { NgIf } from "@angular/common";
import { FormattedFileSizePipe } from "@isms-core/pipes";

@Component({
  selector: "isms-single-file-upload-selector",
  templateUrl: "./single-file-upload-selector.component.html",
  standalone: true,
  imports: [NgIf, FormattedFileSizePipe],
})
export class SingleFileUploadSelectorComponent {
  @Output("on-change") onChange: EventEmitter<IFileUploadSelector> = new EventEmitter<IFileUploadSelector>();
  @Input("value") value: IFileUploadSelector;

  public onFileChange(event: Event): void {
    const fileReader = new FileReader();
    const inputEvent = event.target as HTMLInputElement;

    fileReader.readAsDataURL(inputEvent.files[0]);

    const { type, name, size } = inputEvent.files[0];
    console.log(size / 1024 / 1024 + "MB");

    fileReader.onload = () => {
      const base64FileSource = fileReader.result as string;
      console.log("base64FileSource", base64FileSource);
      this.onChange.emit({
        fileName: name,
        size: size,
        value: base64FileSource,
      });
    };
  }
}
