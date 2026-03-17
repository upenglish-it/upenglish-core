import { Directive, ElementRef, OnInit } from "@angular/core";

@Directive({
  selector: "[remove-component-tag]",
  standalone: true,
})
export class RemoveComponentTagDirective implements OnInit {
  private nativeElement: HTMLElement;

  constructor(elementRef: ElementRef) {
    this.nativeElement = elementRef.nativeElement;
  }

  ngOnInit(): void {
    const parentElement: HTMLElement = this.nativeElement.parentElement;

    if (parentElement) {
      while (this.nativeElement.firstChild) {
        parentElement.insertBefore(this.nativeElement.firstChild, this.nativeElement);
      }
    }

    if (parentElement) {
      parentElement.removeChild(this.nativeElement);
    }
  }
}
