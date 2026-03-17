import { Directive, EventEmitter, HostBinding, HostListener, Input, Output } from "@angular/core";

@Directive({
  selector: "[upload-file]",
  standalone: true,
})
export class UploadFileDirective {
  @HostBinding("class.upload-file-focus") fileOver: boolean;
  @Output() fileDropped = new EventEmitter<any>();

  // Dragover listener
  @HostListener("dragover", ["$event"])
  onDragOver(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.fileOver = true;
  }

  // Dragleave listener
  @HostListener("dragleave", ["$event"])
  public onDragLeave(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.fileOver = false;
  }

  // Drop listener
  @HostListener("drop", ["$event"])
  public ondrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.fileOver = false;
    this.fileDropped.emit(event.dataTransfer.files);
  }
}
