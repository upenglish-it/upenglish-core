// /**
//  * Movable Textbox Component
//  *
//  * @file          movable-textbox.component
//  * @description   This component allows the teacher to create and edit movable textboxes.
//  * @author        John Mark Alicante
//  * @since         2025 - 05 - 01
//  */

// //--- NG Modules
// import { AfterViewInit, Component, ElementRef, inject, Input, OnInit, ViewChild } from "@angular/core";
// //--- Ulidx
// import { ulid } from "ulidx";
// //--- Components
// import { TextboxPointsConfigModalComponent } from "../textbox-points-config-modal/textbox-points-config-modal.component";

// @Component({
//   selector: "slms-movable-textbox",
//   imports: [
//     //--- Components
//     TextboxPointsConfigModalComponent,
//   ],
//   templateUrl: "./movable-textbox.component.html",
//   styleUrl: "./movable-textbox.component.less",
// })
// export class MovableTextboxComponent implements OnInit, AfterViewInit {
//   @ViewChild("textboxPointsConfigModal") textboxPointsConfigModal: TextboxPointsConfigModalComponent;

//   @Input({ alias: "text", required: true }) public text: string;
//   @Input({ alias: "points", required: true }) public points: string;
//   @Input({ alias: "item-number", required: true }) public itemNumber: string;
//   @Input({ alias: "view-mode", required: true }) public viewMode: "editing" | "viewing";
//   @Input({ alias: "participant-answer", required: true }) public participantAnswer: string;

//   //--- Injectables
//   private elementRef: ElementRef = inject(ElementRef);

//   //--- Public
//   public elementId: string = ulid();
//   public element: HTMLElement | null = null;

//   /**
//    * @name          ngOnInit
//    * @description   Called when component is initialize
//    * @returns       {void}
//    */
//   public ngOnInit(): void {}

//   /**
//    * @name          ngAfterViewInit
//    * @description   Called after the view has been initialized
//    * @returns       {void}
//    */
//   public ngAfterViewInit(): void {
//     this.element = this.elementRef.nativeElement as HTMLElement;
//     this.element.setAttribute("id", this.elementId);
//     this.element.setAttribute("contenteditable", "false");

//     if (this.viewMode === "editing") {
//       this.dragElement(document.getElementById(this.elementId));
//     }
//   }

//   /**
//    * @name          dragElement
//    * @description   Drag element to move it around the screen
//    * @param         {any} elmnt - The element to be dragged
//    * @returns       {void}
//    */
//   public dragElement(elmnt: any): void {
//     var pos1 = 0,
//       pos2 = 0,
//       pos3 = 0,
//       pos4 = 0;
//     if (document.getElementById(elmnt.id)) {
//       /* if present, the header is where you move the DIV from:*/
//       document.getElementById(elmnt.id).onmousedown = dragMouseDown;
//     } else {
//       /* otherwise, move the DIV from anywhere inside the DIV:*/
//       elmnt.onmousedown = dragMouseDown;
//     }

//     function dragMouseDown(e: any) {
//       console.log("dragMouseDown>>", e);
//       e = e || window.event;
//       e.preventDefault();
//       // get the mouse cursor position at startup:
//       pos3 = e.clientX;
//       pos4 = e.clientY;
//       document.onmouseup = closeDragElement;
//       // call a function whenever the cursor moves:
//       document.onmousemove = elementDrag;
//     }

//     function elementDrag(e: any) {
//       console.log("elementDrag>>", e);

//       e = e || window.event;
//       // e.preventDefault();
//       // calculate the new cursor position:
//       pos1 = pos3 - e.clientX;
//       pos2 = pos4 - e.clientY;
//       pos3 = e.clientX;
//       pos4 = e.clientY;
//       // set the element's new position:
//       elmnt.style.top = elmnt.offsetTop - pos2 + "px";
//       elmnt.style.left = elmnt.offsetLeft - pos1 + "px";
//     }

//     function closeDragElement() {
//       /* stop moving when mouse button is released:*/
//       document.onmouseup = null;
//       document.onmousemove = null;
//     }
//   }

//   /**
//    * @name          delete
//    * @description   Delete element
//    * @returns       {void}
//    */
//   public delete(): void {
//     this.element.remove();
//   }

//   /**
//    * @name          participantTypedAnswer
//    * @description   Set the participant's answer for the movable textbox
//    * @param         {string} answer
//    * @returns       {void}
//    */
//   public participantTypedAnswer(answer: string): void {
//     if (this.viewMode === "viewing") {
//       this.element.setAttribute("participant-answer", answer);
//     }
//   }

//   /**
//    * @name          updateAttribute
//    * @description   Update the attributes of the movable textbox
//    * @returns       {void}
//    */
//   public updateAttribute(): void {
//     this.textboxPointsConfigModal.textboxFormGroup.get("itemNumber").setValue(this.element.getAttribute("item-number"));
//     this.textboxPointsConfigModal.textboxFormGroup.get("elementId").setValue(this.elementId);
//     this.textboxPointsConfigModal.textboxFormGroup.get("points").setValue(parseInt(this.element.getAttribute("points")));
//     this.textboxPointsConfigModal.showModal = true;
//   }
// }

// export const MovableTextboxInjector = (params: {
//   editor: HTMLElement;
//   associatedQuestionId: string;
//   viewMode: "editing" | "viewing";
//   points: string;
//   itemNumber: string;
//   participantAnswer: string;
// }): void => {
//   const html = `<slms-movable-textbox movable="true" associated-question-id="${params.associatedQuestionId}" view-mode="${params.viewMode}" points="${params.points}" item-number="${params.itemNumber}" participant-answer="${params.participantAnswer}"></slms-movable-textbox>`;

//   const range = document.createRange();
//   range.setStart(params.editor, 0);
//   range.collapse(true);
//   // Get the current Selection and apply the range
//   const temp = document.createElement("div");
//   temp.innerHTML = html;
//   const nodeToInsert = temp.firstElementChild;

//   if (nodeToInsert) {
//     range.insertNode(nodeToInsert);

//     // Optional: insert a space after so user can continue typing
//     const space = document.createTextNode("\u00A0"); // non-breaking space
//     range.setStartAfter(nodeToInsert);
//     range.insertNode(space);
//   }
// };
