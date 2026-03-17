// /**
//  * Static Textbox Component
//  *
//  * @file          static-textbox.component
//  * @description   This component allows the teacher to create and edit static textboxes.
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
//   selector: "slms-static-textbox",
//   imports: [
//     //--- Components
//     TextboxPointsConfigModalComponent,
//   ],
//   templateUrl: "./static-textbox.component.html",
//   styleUrl: "./static-textbox.component.less",
// })
// export class StaticTextboxComponent implements OnInit, AfterViewInit {
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

// export const StaticTextboxInjector = (params: {
//   associatedQuestionId: string;
//   viewMode: "editing" | "viewing";
//   points: string;
//   itemNumber: string;
//   participantAnswer: string;
// }): void => {
//   const html = `<slms-static-textbox associated-question-id="${params.associatedQuestionId}" view-mode="${params.viewMode}" points="${params.points}" item-number="${params.itemNumber}" participant-answer="${params.participantAnswer}"></slms-static-textbox>`;
//   document.execCommand("insertHTML", false, html);
// };
