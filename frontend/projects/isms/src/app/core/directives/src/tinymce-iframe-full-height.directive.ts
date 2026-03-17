import { AfterContentInit, Directive, ElementRef, HostListener, Input, OnChanges, SimpleChanges } from "@angular/core";

@Directive({
  selector: "[tinymce-iframe-full-height]",
  standalone: true,
})
export class TinyMCEIFrameFullHeightDirective implements AfterContentInit, OnChanges {
  @Input("expand") public expand: boolean;
  private loadIframeTimer: any = null;

  constructor(private readonly elementRef: ElementRef) {}

  public ngOnChanges(changes: SimpleChanges): void {
    this.loadIframe();
  }

  public ngAfterContentInit(): void {
    this.loadIframeTimer = setInterval(() => {
      this.loadIframe();
    }, 500);
  }

  private loadIframe(): void {
    const elementId = this.elementRef.nativeElement.id;
    if (document.getElementById(elementId)) {
      if (document.getElementById(elementId).getElementsByTagName("iframe").length > 0) {
        const iframe = document.getElementById(elementId).getElementsByTagName("iframe")[0] as HTMLIFrameElement;
        var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc.readyState == "complete") {
          const iframeFullHeight = (document.getElementById(elementId).getElementsByTagName("iframe")[0] as HTMLIFrameElement).contentWindow.document.body.offsetHeight + 26 + "px";
          (document.getElementById(elementId).getElementsByTagName("iframe")[0] as HTMLIFrameElement).style.background = "transparent";
          (document.getElementById(elementId).getElementsByTagName("iframe")[0] as HTMLIFrameElement).style.userSelect = "none";
          console.log("iframeFullHeight", iframeFullHeight);
          (document.getElementById(elementId).querySelectorAll('[role="application"]')[0] as HTMLIFrameElement).style.height = iframeFullHeight;
          clearInterval(this.loadIframeTimer);
          return;
        }
      }
    }
  }

  // @HostListener("change") ngOnChanges() {
  //   console.log("test");
  // }
}
