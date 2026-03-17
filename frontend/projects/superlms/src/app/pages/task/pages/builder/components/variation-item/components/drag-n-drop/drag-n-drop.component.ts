/**
 * Drag N Drop Component
 *
 * @file          drag-n-drop.component
 * @description   This component handles the drag and drop functionality for the editor.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { AfterViewInit, Component, ElementRef, inject, Input } from "@angular/core";
import { FormArray, FormGroup, ReactiveFormsModule } from "@angular/forms";
//--- NG Zorro
import { NzInputModule } from "ng-zorro-antd/input";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
//--- Form Group
import { DragNDropFormGroup } from "../../../../form-group/test-variation-part-item-form.form-group";
import { NzButtonModule } from "ng-zorro-antd/button";
//--- Components
import { AnswerBoxInjector } from "../../../editor/components/answer-box/answer-box/answer-box.component";
import { NgClass } from "@angular/common";

@Component({
  selector: "slms-drag-n-drop",
  templateUrl: "./drag-n-drop.component.html",
  styleUrl: "./drag-n-drop.component.less",
  imports: [
    //--- NG Modules
    NgClass,
    ReactiveFormsModule,
    //--- NG Zorro
    NzRadioModule,
    NzInputModule,
    NzButtonModule,
    NzToolTipModule,
    NzInputNumberModule,
    //--- Prime NG
    // EditorModule,
  ],
})
export class DragNDropComponent implements AfterViewInit {
  @Input({ alias: "item-index", required: true }) itemIndex: number;
  @Input({ alias: "form-group", required: true }) formGroup: FormGroup;
  @Input({ alias: "item-form-group", required: true }) itemFormGroup: FormGroup;
  @Input({ alias: "part-form-group", required: true }) partFormGroup: FormGroup;

  // @Input({ alias: "participant-dropped-answer", required: false }) public participantDroppedAnswer = (value: any) => {
  //   console.log("participantDroppedAnswer value", value);
  // };

  //--- Injectables
  private elementRef: ElementRef = inject(ElementRef);

  /**
   * @name          ngAfterViewInit
   * @description   Called after the view has been initialized
   * @returns       {void}
   */
  public ngAfterViewInit(): void {
    this.listenToElements();
  }

  dragstartHandler(ev: any, participantAnswerText: string): void {
    const dataAnswerId = (ev.target as HTMLElement).getAttribute("data-answer-id");

    ev.dataTransfer.setData(
      "text",
      JSON.stringify({
        participantAnswerText: participantAnswerText,
        participantAnswerId: dataAnswerId,
      })
    );
  }

  /**
   * @name          listenToDraggableElements
   * @description   Listen to draggable elements like `drag-n-drop` component
   * @returns       {void}
   */
  public listenToElements(): void {
    const draggables = document.querySelectorAll(".dnd-draggable");

    console.log("draggables", draggables.length);

    // When drag starts
    draggables.forEach((item) => {
      item.addEventListener("participant-dropped-answer", (ev) => {
        console.log("participant-dropped-answer:", ev);

        const { originalAnswer, participantAnswerId, points, score } = (ev as CustomEvent).detail;

        const dataAnswerId = (ev.target as HTMLElement).getAttribute("data-answer-id");

        console.log(">>>", originalAnswer, participantAnswerId, points, score, " :dataAnswerId: ", dataAnswerId);

        const dragDropFormGroup = this.dragNDropFormArray.controls.findIndex((dndFG) => dndFG.value.id === originalAnswer);

        this.dragNDropFormArray.at(dragDropFormGroup).patchValue({
          participantAnswer: participantAnswerId,
          reviewerAnswer: participantAnswerId,
          points: points,
          score: score,
        });
      });
    });
  }

  /**
   * @name          dragStart
   * @description   Drag start event handler
   * @param         {DragEvent} ev - The drag event
   * @returns       {void}
   */
  public dragStart(ev: DragEvent): void {
    console.log(ev);
    const data: HTMLDivElement = ev.target as HTMLDivElement;
    ev.dataTransfer.setData(
      "text",
      JSON.stringify({
        text: data.innerText,
        participantAnswerId: data.getAttribute("participant-answer-id"),
      })
    );
  }

  /**
   * @name          addItem
   * @description   Adds a new item to the drag and drop form array
   * @returns       {void}
   */
  public addItem(): void {
    this.dragNDropFormArray.push(DragNDropFormGroup());
  }

  /**
   * @name          dragNDropFormArray
   * @description   Getter of the drag and drop form array
   * @returns       {FormArray}
   */
  public get dragNDropFormArray(): FormArray {
    return this.itemFormGroup.get("dragDrop") as FormArray;
  }

  /**
   * @name          dragNDropFormGroup
   * @description   Getter of the drag and drop form group
   * @returns       {FormGroup}
   */
  public dragNDropFormGroup(formGroupIndex: number): FormGroup {
    return this.dragNDropFormArray.at(formGroupIndex) as FormGroup;
  }

  // /**
  //  * @name          insertMovableTextbox
  //  * @description   Inserts a movable textbox into the editor
  //  * @returns       {void}
  //  */
  // public insertMovableTextbox(): void {
  //   const editor = document.getElementById(this.variationFormGroup.value.id);
  //   editor.focus();
  //   MovableTextboxInjector({
  //     editor: editor,
  //     associatedQuestionId: this.itemFormGroup.value.id,
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
  //   const editor = document.getElementById(this.variationFormGroup.value.id);
  //   editor.focus();
  //   StaticTextboxInjector({
  //     associatedQuestionId: this.itemFormGroup.value.id,
  //     viewMode: "editing",
  //     points: "1",
  //     itemNumber: "",
  //     participantAnswer: "",
  //   });
  // }

  /**
   * @name          insertMovableTextbox
   * @description   Inserts a movable textbox into the editor
   * @returns       {void}
   */
  public insertDropzone(type: "static-dropzone" | "movable-dropzone", associatedQuestionItemId: string): void {
    const editor = document.getElementById(this.partFormGroup.value.id);
    editor.focus();
    AnswerBoxInjector({
      type: type,
      editor: editor,
      associatedQuestionId: this.itemFormGroup.value.id,
      associatedQuestionItemId: associatedQuestionItemId,
      viewMode: "editing",
      points: "1",
      answerNumber: "0",
      participantAnswer: "",
    });
  }
}
