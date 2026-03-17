/**
 * Builder Component
 *
 * @file          builder.component
 * @description   This page allows the teacher to create and edit tasks.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, inject, Input, ViewChild, ViewEncapsulation } from "@angular/core";
//--- Ulidx
import { ulid } from "ulidx";
//--- Types
// type ToolbarType = "bold" | "italic" | "|" | "movable-textbox" | "static-textbox" | "movable-dropzone" | "static-dropzone";
//--- Directives
import { EditorComponentRendererDirective } from "../variation-item/directives/editor-component-renderer/editor-component-renderer.directive";
//--- Prime NG
import { TooltipModule } from "primeng/tooltip";
//--- NG Zorro
import { FormControl } from "@angular/forms";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NgStyle } from "@angular/common";
import { ViewTypeT } from "./components/table-box/table-box/table-box.component";

@Component({
  selector: "slms-editor",
  imports: [
    NgStyle,
    //--- NG Zorro
    NzButtonModule,
    //--- Prime NG
    TooltipModule,
    //--- Directives
    EditorComponentRendererDirective,
  ],
  templateUrl: "./editor.component.html",
  styleUrl: "./editor.component.less",
  encapsulation: ViewEncapsulation.None,
})
export class EditorComponent implements AfterViewInit {
  @ViewChild("editorContainer", { read: ElementRef, static: true }) private editorContainer: ElementRef;

  @Input({ alias: "content-form-control", required: true }) public contentFormControl: FormControl;
  @Input({ alias: "editor-id", required: true }) public editorId: string;
  @Input({ alias: "min-height", required: false }) public minHeight: number = 700;
  @Input({ alias: "mode", required: true }) public mode: "editing" | "viewing" = "editing";
  @Input({ alias: "enable-fill-in-blank", required: false }) public enableFillInBlank: boolean = false;

  @Input({ alias: "toolbars", required: false }) public toolbars: { title: string; id: string; value: string; icon: string; command?: () => void }[] = [
    { id: ulid(), title: "Bold text style.", value: "bold", icon: "ph-bold ph-text-b", command: () => this.executeCommand("bold") },
    { id: ulid(), title: "Italic text style.", value: "italic", icon: "ph-bold ph-text-italic", command: () => this.executeCommand("italic") },
    { id: ulid(), title: "Image can be use for embedding image.", value: "image", icon: "ph-bold ph-images", command: () => this.insertImage() },
    { id: ulid(), title: "Use to checkbox one answer.", value: "table", icon: "ph-bold ph-checks", command: () => this.insertTable("radio") },
    { id: ulid(), title: "Use to fill in answers.", value: "table", icon: "ph-bold ph-table", command: () => this.insertTable("input") },
    // { id: ulid(), value: "|", icon: "ph-bold ph-line-vertical" },
    // { id: ulid(), value: "|", icon: "ph-bold ph-arrows-out-cardinal", command: () => this.insertMovableTextbox() },
    // { id: ulid(), value: "|", icon: "ph-bold ph-textbox", command: () => this.insertStaticTextbox() },
    // { id: ulid(), value: "|", icon: "ph-bold ph-rectangle-dashed", command: () => this.executeCommand("italic") },
  ];

  //--- Injectables
  private changeDetectorRef: ChangeDetectorRef = inject(ChangeDetectorRef);

  //--- Public
  public editorTextContent: string = "";

  //--- Private
  private observer!: MutationObserver;

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    //--- Optionally append fill-in blank toolbar for fill-in-input type
    if (this.enableFillInBlank) {
      this.toolbars = [
        ...this.toolbars,
        {
          id: ulid(),
          title: 'Place the cursor where you want a blank, then click "Add Blank".',
          value: "fill-in-blank",
          icon: "ph-bold ph-text-t",
          command: () => this.insertBlankInput(),
        },
      ];
    }
  }

  /**
   * @name          ngAfterViewInit
   * @description   Called after the view has been initialized
   * @returns       {void}
   */
  public ngAfterViewInit(): void {
    console.log("htmlContent", this.contentFormControl.value);

    // setTimeout(() => {
    this.editorTextContent = this.contentFormControl.value;
    this.textChangeObserver();

    const targetNode = document.getElementById(this.editorId);
    //   console.log("Editor Component Initialized", targetNode);
    // }, 300);

    this.changeDetectorRef.detectChanges();
  }

  public textChangeObserver(): void {
    console.log("targetNode1");

    const targetNode = document.getElementById(this.editorId);
    console.log("targetNode", targetNode);
    if (targetNode) {
      this.observer = new MutationObserver((mutations) => {
        const html = targetNode.innerHTML;
        this.contentFormControl.setValue(html, { emitModelToViewChange: true, emitViewToModelChange: false });
      });

      this.observer.observe(targetNode, {
        childList: true, // new/remove nodes
        subtree: true, // deep changes
        characterData: true, // text content
        attributes: true, // style/class changes
        // attributeFilter: ["class", "style"], // optional: limit attribute types
      });
    }
  }

  /**
   * @name          ngOnDestroy
   * @description   Called when component is destroyed
   * @returns       {void}
   */
  public ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  /**
   * @name          executeCommand
   * @description   Executes a command in the editor.
   * @returns       {void}
   */
  public executeCommand(command: string): void {
    document.execCommand(command, false, this.contentFormControl.value);
  }

  /**
   * @name          insertBlankInput
   * @description   Inserts an inline blank placeholder for fill-in-input questions
   * @returns       {void}
   */
  public insertBlankInput(): void {
    const editor = document.getElementById(this.editorId);
    if (!editor) {
      return;
    }

    editor.focus();

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    // Ensure there is a range inside the editor
    if (selection.rangeCount === 0) {
      const fallbackRange = document.createRange();
      fallbackRange.setStart(editor, editor.childNodes.length);
      fallbackRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(fallbackRange);
    }

    const range = selection.getRangeAt(0);

    // Guard: if selection is completely outside the editor, bail out
    if (!editor.contains(range.commonAncestorContainer)) {
      return;
    }

    // Create the visual blank element
    const blankId = ulid();
    const blank = document.createElement("span");
    blank.className = "slms-fill-input-blank";
    blank.setAttribute("data-blank-id", blankId);
    blank.setAttribute("contenteditable", "false");
    blank.textContent = "Answer";

    // Replace the current selection with the blank
    range.deleteContents();
    range.insertNode(blank);

    // Insert a non‑breaking space after so the user can keep typing
    const space = document.createTextNode("\u00A0");
    const afterRange = document.createRange();
    afterRange.setStartAfter(blank);
    afterRange.collapse(true);
    afterRange.insertNode(space);

    // Position the caret after the space
    selection.removeAllRanges();
    const caretRange = document.createRange();
    caretRange.setStartAfter(space);
    caretRange.collapse(true);
    selection.addRange(caretRange);
  }

  // /**
  //  * @name          insertMovableTextbox
  //  * @description   Inserts a movable textbox into the editor
  //  * @returns       {void}
  //  */
  // public insertMovableTextbox(): void {
  //   const editor = document.getElementById(this.editorId);
  //   editor.focus();
  //   MovableAnswerBoxInjector({
  //     type: "movable-dropzone",
  //     editor: editor,
  //     associatedQuestionId: "",
  //     viewMode: "editing",
  //     points: "1",
  //     itemNumber: "",
  //     participantAnswer: "",
  //   });
  // }

  // /**
  //  * @name          insertStaticTextbox
  //  * @description   Inserts a static textbox into the editor
  //  * @returns       {void}
  //  */
  // public insertStaticTextbox(): void {
  //   const editor = document.getElementById(this.editorId);
  //   editor.focus();
  //   const html = `<slms-static-textbox view-mode="editing" points="123" item-number="" participant-answer=""></slms-static-textbox>`;
  //   document.execCommand("insertHTML", false, html);
  // }

  // /**
  //  * @name          insertImage
  //  * @description   Inserts an image into the editor
  //  * @returns       {void}
  //  */
  // public insertImage(): void {
  //   const editor = document.getElementById(this.editorId);
  //   editor.focus();
  //   const html = `<img src="https://miro.medium.com/v2/resize:fit:1400/format:webp/1*toJ1NMFTzJuNQ0eKyrPk-g.png" alt="Image details" width="100%">`;
  //   document.execCommand("insertHTML", false, html);
  // }

  /**
   * @name          insertImage
   * @description   Inserts an image into the editor
   * @returns       {void}
   */
  public insertImage(): void {
    const editor = document.getElementById(this.editorId);
    editor.focus();
    const html = `<slms-image-box view-mode="editing" src="https://upev-superlms.s3.ap-southeast-1.amazonaws.com/dev/uploaded/image-box-placeholder.jpg" description=""></slms-image-box>`;
    document.execCommand("insertHTML", false, html);
  }

  /**
   * @name          insertTable
   * @description   Inserts a table into the editor
   * @returns       {void}
   */
  public insertTable(type: ViewTypeT): void {
    const editor = document.getElementById(this.editorId);
    editor.focus();
    const html = `<slms-table-box view-mode="editing" 
                    table-title="Questions List"
                    view-type="${type}"
                    questions="[]"
                    answer-choices="[]"
                  ></slms-table-box><br/>`;
    document.execCommand("insertHTML", false, html);
  }
}
