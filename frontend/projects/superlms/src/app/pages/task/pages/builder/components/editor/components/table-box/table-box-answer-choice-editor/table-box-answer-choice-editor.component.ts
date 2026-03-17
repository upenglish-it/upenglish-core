/**
 * Table Box Answer Choice Editor Component
 *
 * @file          table-box-answer-choice-editor.component
 * @description   This component is responsible for rendering the answer choice editor within a table box.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Component, ElementRef, Input, ViewChild, ViewEncapsulation } from "@angular/core";
//--- Ulidx
import { ulid } from "ulidx";
//--- NG Zorro
import { FormControl } from "@angular/forms";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NgStyle } from "@angular/common";
import { TableBoxAnswerChoiceEditorDirectiveRenderer } from "./directives/table-box-answer-choice-editor-renderer/table-box-answer-choice-editor-renderer.directive";

@Component({
  selector: "slms-table-box-answer-choice-editor",
  imports: [
    NgStyle,
    //--- NG Zorro
    NzButtonModule,
    //--- Directives
    TableBoxAnswerChoiceEditorDirectiveRenderer,
  ],
  templateUrl: "./table-box-answer-choice-editor.component.html",
  styleUrl: "./table-box-answer-choice-editor.component.less",
  encapsulation: ViewEncapsulation.None,
})
export class TableBoxAnswerChoiceEditorComponent {
  @ViewChild("editorContainer", { read: ElementRef, static: true }) private editorContainer: ElementRef;

  @Input({ alias: "content-form-control", required: true }) public contentFormControl: FormControl;
  @Input({ alias: "editor-id", required: true }) public editorId: string;
  @Input({ alias: "min-height", required: false }) public minHeight: number = 700;
  @Input({ alias: "mode", required: true }) public mode: "editing" | "viewing" = "editing";

  @Input({ alias: "toolbars", required: false }) public toolbars: { title: string; id: string; value: string; icon: string; command?: () => void }[] = [
    { id: ulid(), title: "Bold text style.", value: "bold", icon: "ph-bold ph-text-b", command: () => this.executeCommand("bold") },
    { id: ulid(), title: "Italic text style.", value: "italic", icon: "ph-bold ph-text-italic", command: () => this.executeCommand("italic") },
    { id: ulid(), title: "Table can be use for box ticking and fill in.", value: "table", icon: "ph-bold ph-textbox", command: () => this.insertTextBox() },
    // { id: ulid(), value: "|", icon: "ph-bold ph-line-vertical" },
    // { id: ulid(), value: "|", icon: "ph-bold ph-arrows-out-cardinal", command: () => this.insertMovableTextbox() },
    // { id: ulid(), value: "|", icon: "ph-bold ph-textbox", command: () => this.insertStaticTextbox() },
    // { id: ulid(), value: "|", icon: "ph-bold ph-rectangle-dashed", command: () => this.executeCommand("italic") },
  ];

  //--- Public
  public htmlContent = "Type content here...";

  //--- Private
  private observer!: MutationObserver;

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.htmlContent = this.contentFormControl.value;

    //--- Set an ID
    this.toolbars.map((toolbar) => {
      return { id: ulid(), ...toolbar };
    });
  }

  /**
   * @name          ngAfterViewInit
   * @description   Called after the view has been initialized
   * @returns       {void}
   */
  public ngAfterViewInit(): void {
    this.textChangeObserver();
  }

  public textChangeObserver(): void {
    const targetNode = document.getElementById(this.editorId);
    if (targetNode) {
      this.observer = new MutationObserver((mutations) => {
        const html = targetNode.innerHTML;
        this.contentFormControl.setValue(html);
      });
      this.observer.observe(targetNode, {
        childList: true, // new/remove nodes
        subtree: true, // deep changes
        characterData: true, // text content
        attributes: true, // style/class changes
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
    document.execCommand(command, false, this.htmlContent);
  }

  /**
   * @name          insertTable
   * @description   Inserts a table into the editor
   * @returns       {void}
   */
  public insertTextBox(): void {
    // const editor = document.getElementById(this.editorId);
    // editor.focus();
    // const html = `<slms-table-box-input-box></slms-table-box-input-box>`;
    // document.execCommand("insertHTML", false, html);

    const editor = document.getElementById(this.editorId);
    editor.focus();
    const html = `<slms-table-box-input-box 
                    view-mode="editing" 
                  ></slms-table-box-input-box><br/>`;
    document.execCommand("insertHTML", false, html);
  }
}
