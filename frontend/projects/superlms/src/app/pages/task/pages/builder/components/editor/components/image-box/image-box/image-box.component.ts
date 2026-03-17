/**
 * Image Box Component
 *
 * @file          image-box.component
 * @description   This component is responsible for rendering an image box
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { AfterViewInit, Component, ElementRef, inject, Input, OnInit, ViewChild } from "@angular/core";
//--- Ulidx
import { ulid } from "ulidx";
//--- Components
import { ImageBoxConfigModalComponent } from "../image-box-config-modal/image-box-config-modal.component";
import { CdkDragDrop } from "@angular/cdk/drag-drop";
import { NzButtonModule } from "ng-zorro-antd/button";
//--- Types
type AnswerBoxType = "movable-textbox" | "static-textbox" | "movable-dropzone" | "static-dropzone";

@Component({
  selector: "slms-answer-box",
  imports: [
    //--- NG Zorro
    NzButtonModule,
    //--- Components

    ImageBoxConfigModalComponent,
  ],
  templateUrl: "./image-box.component.html",
  styleUrl: "./image-box.component.less",
})
export class ImageBoxComponent implements OnInit, AfterViewInit {
  //--- ViewChilds
  @ViewChild("imageBoxConfigModal") imageBoxConfigModal: ImageBoxConfigModalComponent;

  //--- Inputs
  @Input({ alias: "src", required: true }) public src: string;
  @Input({ alias: "description", required: true }) public description: string;
  @Input({ alias: "view-mode", required: true }) public viewMode: "editing" | "viewing";
  @Input({ alias: "associated-question-id", required: true }) public associatedQuestionId: string;

  //--- Injectables
  private elementRef: ElementRef = inject(ElementRef);

  //--- Publics
  public elementId: string = ulid();
  public element: HTMLElement | null = null;

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {}

  /**
   * @name          ngAfterViewInit
   * @description   Called after the view has been initialized
   * @returns       {void}
   */
  public ngAfterViewInit(): void {
    this.element = this.elementRef.nativeElement as HTMLElement;
    this.element.setAttribute("id", this.elementId);
    this.element.setAttribute("contenteditable", "false");
  }

  /**
   * @name          delete
   * @description   Delete element
   * @returns       {void}
   */
  public delete(): void {
    this.element.remove();
  }

  /**
   * @name          updateAttribute
   * @description   Update the attributes of the movable textbox
   * @returns       {void}
   */
  public updateAttribute(): void {
    // console.log("this.element.getAttribute", this.element.getAttributeNames());
    // this.imageBoxConfigModal.textboxFormGroup.get("answerNumber").setValue(this.element.getAttribute("answer-number"));
    this.imageBoxConfigModal.imageBoxFormGroup.get("elementId").setValue(this.elementId);
    this.imageBoxConfigModal.imageBoxFormGroup.get("src").setValue(this.element.getAttribute("src"));
    // this.imageBoxConfigModal.textboxFormGroup.get("points").setValue(parseInt(this.element.getAttribute("points")));
    this.imageBoxConfigModal.showModal = true;
  }

  onDrop(event: CdkDragDrop<string[]>) {
    console.log("onDrop>>", event);
  }
}

// /**
//  * @name          ImageBoxInjector
//  * @description   Injects an image box into the editor.
//  * @param         {Object} params
//  * @returns       {void}
//  */
// export const ImageBoxInjector = (params: {
//   type: AnswerBoxType;
//   editor: HTMLElement;
//   description: string;
//   associatedQuestionId: string;
//   viewMode: "editing" | "viewing";
// }): void => {
//   const editor = document.getElementById(params.editor.id);
//   editor.focus();
//   const html = `<slms-image-box view-mode="${params.viewMode}" src="https://upev-superlms.s3.ap-southeast-1.amazonaws.com/dev/uploaded/image-box-placeholder.jpg" description="${params.description}"></slms-image-box>`;
//   document.execCommand("insertHTML", false, html);
// };
