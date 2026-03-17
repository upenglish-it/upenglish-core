import { AfterContentInit, AfterViewInit, Directive, ElementRef, EventEmitter, HostBinding, HostListener, Input, OnInit, Output } from "@angular/core";

@Directive({
  selector: "[iframe-previewer]",
  standalone: true,
})
export class IFramePreviewerDirective implements OnInit {
  constructor(private readonly elementRef: ElementRef) {}

  public ngOnInit(): void {
    // public ngAfterViewInit(): void {
    const nativeEl = this.elementRef.nativeElement;
    if ((nativeEl.contentDocument || nativeEl.contentWindow.document).readyState === "complete") {
      nativeEl.onload = this.onIframeLoad.bind(this);
    } else {
      if (nativeEl.addEventListener) {
        nativeEl.addEventListener("load", this.onIframeLoad.bind(this), true);
      } else if (nativeEl.attachEvent) {
        nativeEl.attachEvent("onload", this.onIframeLoad.bind(this));
      }
    }
  }

  // public ngAfterContentInit(): void {
  //   // setInterval(() => {
  //   //   console.log(this.elementRef.nativeElement.contentWindow.document.body.scrollHeight);
  //   //   // this.elementRef.nativeElement.style.height =
  //   //   //   this.elementRef.nativeElement.contentWindow.document.body.offsetHeight + 'px';
  //   // }, 1000);
  //   // this.elementRef.nativeElement.style.height =
  //   //   this.elementRef.nativeElement.contentWindow.document.body.offsetHeight + 'px';
  // }

  private onIframeLoad(): void {
    const base64String = this.elementRef.nativeElement.contentWindow.document.body.innerHTML;
    // console.log(this.elementRef.nativeElement.contentWindow.document.body);
    // console.log(this.elementRef.nativeElement.contentWindow.document.body);
    const uiLink = document.createElement("link");
    uiLink.href = "./assets/tinymce/skins/ui/oxide/content.min.css";
    uiLink.rel = "stylesheet";
    uiLink.type = "text/css";
    this.elementRef.nativeElement.contentWindow.document.head.appendChild(uiLink);

    const contentLink = document.createElement("link");
    contentLink.href = "./assets/tinymce/skins/content/default/content.min.css";
    contentLink.rel = "stylesheet";
    contentLink.type = "text/css";
    this.elementRef.nativeElement.contentWindow.document.head.appendChild(contentLink);

    // const styleLink = document.createElement('style');
    // styleLink.type = 'text/css';
    // (styleLink as any).styleSheet.cssText = 'body { font-size:12px; }';
    // contentLink.href = './assets/tinymce/skins/content/default/content.min.css';
    // contentLink.rel = 'stylesheet';
    // this.elementRef.nativeElement.contentWindow.document.head.appendChild(
    //   document.createTextNode('body { font-size:12px; }'),
    // );
    this.elementRef.nativeElement.contentWindow.document.head.insertAdjacentHTML("beforeend", `<style>body { font-size:12px; margin:0px !important;height:100%;}</style>`);
    console.log(">>", this.elementRef.nativeElement.contentWindow.innerHeight, this.elementRef.nativeElement.contentWindow.document.body.clientHeight);

    // const body = this.elementRef.nativeElement.contentWindow.document.body;
    // const html = this.elementRef.nativeElement.contentWindow.document.documentElement;
    // this.elementRef.nativeElement.style.height =
    //   this.elementRef.nativeElement.contentWindow.innerHeight +
    //   this.elementRef.nativeElement.contentWindow.document.body.clientHeight +
    //   'px';

    setTimeout(() => {
      console.log(this.elementRef.nativeElement.contentWindow.document.body.scrollHeight);
      this.elementRef.nativeElement.style.height =
        // this.elementRef.nativeElement.contentWindow.innerHeight +
        this.elementRef.nativeElement.contentWindow.document.body.clientHeight + 13 + "px";
      // this.elementRef.nativeElement.style.height =
      //   this.elementRef.nativeElement.contentWindow.document.body.scrollHeight + 'px';
    }, 2500);
    // <head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><link rel="stylesheet" type="text/css" id="mce-u0" href="
    // "><link rel="stylesheet" type="text/css" id="mce-u1" href=""><style type="text/css">body { font-size:12px; }</style></head>
  }
}
