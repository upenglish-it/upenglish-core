/**
 * Table Box Answer Choice Editor Directive
 *
 * @file          table-box-answer-choice-editor-renderer.directive.ts
 * @description   This directive is responsible for rendering custom editor components
 * @author        John Mark Alicante
 * @since         2025 - 10 - 27
 */

//--- NG Modules
import { Directive, ElementRef, inject, Injector, Input } from "@angular/core";
import { createCustomElement } from "@angular/elements";
import { TableBoxInputBoxComponent } from "../../components/table-box-input-box/table-box-input-box.component";

@Directive({
  selector: "[slmsTableBoxAnswerChoiceEditorRenderer]",
})
export class TableBoxAnswerChoiceEditorDirectiveRenderer {
  //--- Input
  @Input() set slmsTableBoxAnswerChoiceEditorRenderer(content: string) {
    this.host.nativeElement.innerHTML = content;
  }

  //--- Injectables
  private host: ElementRef = inject(ElementRef);
  private injector: Injector = inject(Injector);

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    //--- Render the draggable and non-draggable answer box components
    if (!customElements.get("slms-table-box-input-box")) {
      customElements.define("slms-table-box-input-box", createCustomElement(TableBoxInputBoxComponent, { injector: this.injector }));
    }

    // //--- Render the image box component
    // if (!customElements.get("slms-image-box")) {
    //   customElements.define("slms-image-box", createCustomElement(ImageBoxComponent, { injector: this.injector }));
    // }

    // //--- Render the table box component
    // if (!customElements.get("slms-table-box")) {
    //   customElements.define("slms-table-box", createCustomElement(TableBoxComponent, { injector: this.injector }));
    // }
  }
}
