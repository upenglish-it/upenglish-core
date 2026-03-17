/**
 * Movable Textbox Component
 *
 * @file          movable-textbox.component
 * @description   This component allows the teacher to create and edit movable textboxes.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { AfterContentInit, AfterViewInit, Component, ElementRef, inject, Input, OnInit, ViewChild } from "@angular/core";
//--- Ulidx
import { ulid } from "ulidx";
//--- Components
import { AnswerBoxConfigModalComponent } from "../answer-box-config-modal/answer-box-config-modal.component";
import { CdkDragDrop, CdkDropList } from "@angular/cdk/drag-drop";
//--- Types
type AnswerBoxType = "movable-textbox" | "static-textbox" | "movable-dropzone" | "static-dropzone";

@Component({
  selector: "slms-answer-box",
  imports: [
    //--- Components
    CdkDropList,
    AnswerBoxConfigModalComponent,
  ],
  templateUrl: "./answer-box.component.html",
  styleUrl: "./answer-box.component.less",
})
export class AnswerBoxComponent implements OnInit, AfterViewInit {
  //--- ViewChild
  @ViewChild("answerBoxConfigModal") answerBoxConfigModal: AnswerBoxConfigModalComponent;

  //--- Input
  @Input({ alias: "text", required: true }) public text: string;
  @Input({ alias: "points", required: true }) public points: string;
  @Input({ alias: "type", required: true }) public type: AnswerBoxType;
  @Input({ alias: "answer-number", required: true }) public answerNumber: string;
  @Input({ alias: "view-mode", required: true }) public viewMode: "editing" | "viewing";
  @Input({ alias: "participant-answer", required: true }) public participantAnswer: string;
  @Input({ alias: "participant-answer-text", required: true }) public participantAnswerText: string;
  @Input({ alias: "associated-question-id", required: true }) public associatedQuestionId: string;
  @Input({ alias: "associated-question-item-id", required: true }) public associatedQuestionItemId: string;

  //--- Injectables
  public elementRef: ElementRef = inject(ElementRef);

  //--- Public
  public elementId: string = ulid();
  // public element: HTMLElement | null = null;

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {}

  /**
   * @name          ngAfterContentInit
   * @description   Called after content has been initialized
   * @returns       {void}
   */
  public ngAfterViewInit(): void {
    const element = this.elementRef.nativeElement as HTMLElement;
    element.setAttribute("id", this.elementId);
    element.setAttribute("contenteditable", "false");

    if (this.viewMode === "editing" && this.type.includes("movable")) {
      this.dragElement(document.getElementById(this.elementId));
    }

    // this.listenToDraggableElements();
  }

  public dropHandler(ev: any): void {
    ev.preventDefault();
    const participantAnswerData = ev.dataTransfer.getData("text");

    const { participantAnswerId, participantAnswerText } = JSON.parse(participantAnswerData);
    console.log("participantAnswerText", participantAnswerText);

    ev.target.innerText = participantAnswerText;

    //--- Update the attributes
    const element = this.elementRef.nativeElement as HTMLElement;
    element.setAttribute("participant-answer", participantAnswerId);
    element.setAttribute("participant-answer-text", participantAnswerText);

    //--- Dispatch event to notify parent question about the dropped answer
    const dndReceiver = document.querySelector('[data-answer-id="' + participantAnswerId + '"]');

    const points = parseInt(this.points);
    const score = this.associatedQuestionItemId === participantAnswerId ? parseInt(this.points) : 0;

    console.log(">>>>>>1", this.associatedQuestionItemId, participantAnswerId);
    console.log(">>>>>>1.1", this.points);
    console.log(">>>>>>2", points, score);
    dndReceiver.dispatchEvent(
      new CustomEvent("participant-dropped-answer", {
        detail: {
          originalAnswer: this.associatedQuestionId,
          participantAnswerId: participantAnswerId,
          points: points,
          score: score,
        },
      })
    );
  }

  dragoverHandler(ev: any): void {
    ev.preventDefault();
  }

  public listenToDraggableElements(): void {
    // const timer = setInterval(() => {
    //   const dropzones = document.querySelectorAll(".dnd-dropzone");
    //   if (dropzones.length > 0) {
    //     this.listenToDraggableElements();
    //     clearInterval(timer);
    //   }
    // }, 500);

    const timer = setInterval(() => {
      const dropzones = document.querySelectorAll(".dnd-dropzone");
      if (dropzones.length > 0) {
        clearInterval(timer);
        dropzones.forEach((zone) => {
          zone.addEventListener("dragover", (e) => {
            e.preventDefault();
            zone.classList.add("hover");
          });

          zone.addEventListener("dragleave", () => {
            zone.classList.remove("hover");
          });

          zone.addEventListener("drop", (ev: any) => {
            const data = ev.dataTransfer.getData("text");

            console.log("Dropped>>", data, ev.dataTransfer);
            zone.classList.remove("hover");

            // Replace drop zone content with a new custom card
            zone.innerHTML = `
      <div>
        <span>Answer dropped</span>
      </div>
    `;
          });
        });
      } else {
        this.listenToDraggableElements();
      }
    }, 500);
  }

  /**
   * @name          dragElement
   * @description   Drag element to move it around the screen
   * @param         {any} elmnt - The element to be dragged
   * @returns       {void}
   */
  public dragElement(elmnt: any): void {
    var pos1 = 0,
      pos2 = 0,
      pos3 = 0,
      pos4 = 0;
    if (document.getElementById(elmnt.id)) {
      /* if present, the header is where you move the DIV from:*/
      document.getElementById(elmnt.id).onmousedown = dragMouseDown;
    } else {
      /* otherwise, move the DIV from anywhere inside the DIV:*/
      elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e: any) {
      console.log("dragMouseDown>>", e);
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      // call a function whenever the cursor moves:
      document.onmousemove = elementDrag;
    }

    function elementDrag(e: any) {
      console.log("elementDrag>>", e);

      e = e || window.event;
      // e.preventDefault();
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // set the element's new position:
      elmnt.style.top = elmnt.offsetTop - pos2 + "px";
      elmnt.style.left = elmnt.offsetLeft - pos1 + "px";
    }

    function closeDragElement() {
      /* stop moving when mouse button is released:*/
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  /**
   * @name          delete
   * @description   Delete element
   * @returns       {void}
   */
  public delete(): void {
    this.elementRef.nativeElement.remove();
  }

  /**
   * @name          participantTypedAnswer
   * @description   Set the participant's answer for the movable textbox
   * @param         {string} answer
   * @returns       {void}
   */
  public participantTypedAnswer(answer: string): void {
    if (this.viewMode === "viewing") {
      this.elementRef.nativeElement.setAttribute("participant-answer", answer);
    }
  }

  /**
   * @name          updateAttribute
   * @description   Update the attributes of the movable textbox
   * @returns       {void}
   */
  public updateAttribute(): void {
    this.answerBoxConfigModal.textboxFormGroup.get("answerNumber").setValue(this.elementRef.nativeElement.getAttribute("answer-number"));
    this.answerBoxConfigModal.textboxFormGroup.get("elementId").setValue(this.elementId);
    this.answerBoxConfigModal.textboxFormGroup.get("points").setValue(parseInt(this.elementRef.nativeElement.getAttribute("points")));
    this.answerBoxConfigModal.showModal = true;
  }

  onDrop(event: CdkDragDrop<string[]>) {
    console.log("onDrop>>", event);
    this.elementRef.nativeElement.setAttribute("participant-answer", event.item.data.id);
    this.elementRef.nativeElement.setAttribute("participant-answer-text", event.item.data.value);
  }
}

/**
 * @name          AnswerBoxInjector
 * @description   Injects an answer box into the editor.
 * @param         {Object} params - The parameters for the answer box.
 * @returns       {void}
 */
export const AnswerBoxInjector = (params: {
  type: AnswerBoxType;
  editor: HTMLElement;
  associatedQuestionId: string;
  associatedQuestionItemId: string;
  viewMode: "editing" | "viewing";
  points: string;
  answerNumber: string;
  participantAnswer: string;
}): void => {
  const html = `<slms-answer-box type="${params.type}" associated-question-id="${params.associatedQuestionId}" associated-question-item-id="${params.associatedQuestionItemId}"  view-mode="${params.viewMode}" points="${params.points}" answer-number="${params.answerNumber}" participant-answer="${params.participantAnswer}"></slms-answer-box>`;

  //--- Insert the movable answer box
  if (params.type === "movable-textbox" || params.type === "movable-dropzone") {
    const range = document.createRange();
    range.setStart(params.editor, 0);
    range.collapse(true);
    // Get the current Selection and apply the range
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const nodeToInsert = temp.firstElementChild;

    if (nodeToInsert) {
      range.insertNode(nodeToInsert);

      // Optional: insert a space after so user can continue typing
      const space = document.createTextNode("\u00A0"); // non-breaking space
      range.setStartAfter(nodeToInsert);
      range.insertNode(space);
    }
  }

  //--- Insert non-movable answer box
  if (params.type === "static-textbox" || params.type === "static-dropzone") {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    // Get the current Selection and apply the range
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const nodeToInsert = temp.firstElementChild;

    if (nodeToInsert) {
      range.insertNode(nodeToInsert);

      // Optional: insert a space after so user can continue typing
      const space = document.createTextNode("\u00A0"); // non-breaking space
      range.setStartAfter(nodeToInsert);
      range.insertNode(space);
    }
    /////

    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    // document.execCommand("insertHTML", false, html);
  }
};
