import { Directive, ElementRef, EventEmitter, HostBinding, HostListener, Input, Output } from "@angular/core";

@Directive({
  selector: "[profile-photo]",
  standalone: true,
})
export class ProfilePhotoDirective {
  @Input("letter") letter: string;
  @Input("photo") photo: string;

  constructor(private readonly elementRef: ElementRef) {}

  public ngOnInit(): void {
    this.elementRef.nativeElement.draggable = false;
    if (this.photo) {
      this.elementRef.nativeElement.src = this.photo;
    } else {
      this.elementRef.nativeElement.src = `https://ui-avatars.com/api/?background=ffe0dd&color=ff3823&format=svg&length=2&name=${this.letter}`;
    }
  }
}
