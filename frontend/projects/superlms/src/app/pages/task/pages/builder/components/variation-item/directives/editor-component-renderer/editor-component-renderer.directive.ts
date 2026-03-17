/**
 * Editor Component Renderer Directive
 *
 * @file          editor-component-renderer.directive.ts
 * @description   This directive is responsible for rendering custom editor components
 *                by injecting HTML content and defining custom elements.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { createCustomElement } from "@angular/elements";
import { Directive, ElementRef, inject, Injector, Input, OnInit } from "@angular/core";
//--- Components
import { ImageBoxComponent } from "../../../editor/components/image-box/image-box/image-box.component";
import { TableBoxComponent } from "../../../editor/components/table-box/table-box/table-box.component";
import { AnswerBoxComponent } from "../../../editor/components/answer-box/answer-box/answer-box.component";

@Directive({
  selector: "[slmsEditorComponentRenderer]",
})
export class EditorComponentRendererDirective implements OnInit {
  //--- Input
  @Input() set slmsEditorComponentRenderer(content: string) {
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
    if (!customElements.get("slms-answer-box")) {
      customElements.define("slms-answer-box", createCustomElement(AnswerBoxComponent, { injector: this.injector }));
    }

    //--- Render the image box component
    if (!customElements.get("slms-image-box")) {
      customElements.define("slms-image-box", createCustomElement(ImageBoxComponent, { injector: this.injector }));
    }

    //--- Render the table box component
    if (!customElements.get("slms-table-box")) {
      customElements.define("slms-table-box", createCustomElement(TableBoxComponent, { injector: this.injector }));
    }
  }
}
