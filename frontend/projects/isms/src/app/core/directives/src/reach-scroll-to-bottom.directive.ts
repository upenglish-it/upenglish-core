import { Directive, ElementRef, EventEmitter, HostListener, Output } from "@angular/core";

@Directive({
  selector: "[reach-scroll-to-bottom]",
  standalone: true,
})
export class ReachScrollToBottomDirective {
  @Output("on-reach") onReach: EventEmitter<void> = new EventEmitter<any>();

  constructor(private elementRef: ElementRef) {}

  @HostListener("scroll", ["$event"])
  onScroll(): void {
    const element = this.elementRef.nativeElement;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;
    if (scrollTop + clientHeight >= scrollHeight) {
      /* Reached the bottom of the table */
      this.onReach.emit();
    }
  }
}
