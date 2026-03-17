import { AfterViewInit, OnChanges, Directive, ElementRef, HostListener, Input, SecurityContext, SimpleChanges } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";

@Directive({
  selector: "[ellipsis]",
  standalone: true,
})
export class EllipsisDirective implements OnChanges, AfterViewInit {
  @Input() innerHTML?: string;

  private ellipsisSymbol = "&hellip;";
  private ellipsisSeparator = " ";
  private ellipsisSeparatorReg = new RegExp("[" + this.ellipsisSeparator + "]+", "gm");
  private unclosedHTMLTagMatcher = /<[^>]*$/;
  private lastWindowResizeWidth: number = 0;
  private lastWindowResizeHeight: number = 0;
  private resizeObserver!: ResizeObserver;

  constructor(
    private el: ElementRef,
    private sanitizer: DomSanitizer
  ) {
    // this.resizeObserver = new ResizeObserver(() => {
    this.ellipsis();
    // });
  }

  private trustAsHtml(text: string): string | null {
    return this.sanitizer.sanitize(SecurityContext.HTML, text);
  }

  private ellipsis() {
    setTimeout(() => {
      const domElement = this.el.nativeElement;
      let trustedHtml = this.trustAsHtml(this.innerHTML ? this.innerHTML : "");

      if (trustedHtml) {
        domElement.innerHTML = trustedHtml;
        // When the text has overflow
        if (this.isOverflowed()) {
          const initialMaxHeight = domElement.clientHeight;
          const initialMaxWidth = domElement.clientWidth;
          const separatorLocations = [];

          let match;
          // tslint:disable-next-line:no-conditional-assignment
          while ((match = this.ellipsisSeparatorReg.exec(trustedHtml)) !== null) {
            separatorLocations.push(match.index);
          }

          // We know the text overflows and there are no natural breakpoints so we build a new index
          // With this index it will search for the best truncate location instead of for the best ellipsisSeparator location
          if (separatorLocations.length === 0) {
            let textLength = 5;
            while (textLength <= trustedHtml.length) {
              separatorLocations.push(textLength);
              textLength += 5;
            }
            separatorLocations.push(trustedHtml.length);
          }
          let lowerBound = 0;
          let upperBound = separatorLocations.length - 1;
          let textCutOffIndex, range;
          // Loop while upper bound and lower bound are not confined to the smallest range yet
          while (true) {
            // This is an implementation of a binary search as we try to find the overflow position as quickly as possible
            range = upperBound - lowerBound;
            // tslint:disable-next-line:no-bitwise
            textCutOffIndex = lowerBound + (range >> 1);
            if (range <= 1) {
              break;
            } else {
              if (this.fastIsOverflowing(this.getTextUpToIndex(trustedHtml, separatorLocations, textCutOffIndex) + this.ellipsisSymbol, initialMaxHeight, initialMaxWidth)) {
                // The match was in the lower half, excluding the previous upper part
                upperBound = textCutOffIndex;
              } else {
                // The match was in the upper half, excluding the previous lower part
                lowerBound = textCutOffIndex;
              }
            }
          }
          // We finished the search now we set the new text through the correct trustedHtml api
          domElement.innerHTML = this.getTextUpToIndex(trustedHtml, separatorLocations, textCutOffIndex) + this.ellipsisSymbol;

          //Set data-overflow class on element for css stying
          domElement.classList.add("ellipsis-overflowed");
        } else {
          domElement.classList.remove("ellipsis-overflowed");
        }
      } else if (trustedHtml === "") {
        domElement.innerHTML = "";
        domElement.classList.remove("ellipsis-overflowed");
      }
    });
  }

  private isOverflowed(): boolean {
    const elDomNode = this.el.nativeElement;
    return elDomNode.scrollHeight > elDomNode.clientHeight || elDomNode.scrollWidth > elDomNode.clientWidth;
  }

  private fastIsOverflowing(text: string, initialMaxHeight: number, initialMaxWidth: number): boolean {
    const elDomNode = this.el.nativeElement;
    elDomNode.innerHTML = text;
    return elDomNode.scrollHeight > initialMaxHeight || elDomNode.scrollWidth > initialMaxWidth;
  }

  private getTextUpToIndex(htmlText: string, separatorLocations: number[], index: number): string {
    return htmlText.substring(0, separatorLocations[index]).replace(this.unclosedHTMLTagMatcher, "");
  }

  @HostListener("window:resize", ["$event"])
  onResize() {
    if (this.lastWindowResizeWidth !== window.innerWidth || this.lastWindowResizeHeight !== window.innerHeight) {
      this.ellipsis();
    }

    this.lastWindowResizeWidth = window.innerWidth;
    this.lastWindowResizeHeight = window.innerHeight;
  }

  ngOnChanges(changes: SimpleChanges) {
    if ("innerHTML" in changes) {
      this.ellipsis();
    }
  }

  ngAfterViewInit() {
    if (this.innerHTML === undefined && this.el.nativeElement.innerHTML !== "") {
      this.innerHTML = this.el.nativeElement.innerHTML;
      this.ellipsis();
    }
    // this.resizeObserver.observe(this.el.nativeElement);
  }
}
