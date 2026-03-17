// /**
//  * InjectHTML Directive
//  *
//  * @file          inject-html.directive.ts
//  * @description   This directive allows the injection of HTML content into a component.
//  * @author        John Mark Alicante
//  * @since         2025 - 05 - 01
//  */

// //--- NG Modules
// import { Directive, ElementRef, inject, Injector, Input, OnInit } from "@angular/core";
// import { createCustomElement } from "@angular/elements";
// //--- Components
// import { AnswerBoxComponent } from "../../editor/components/answer-box/answer-box.component";

// @Directive({
//   selector: "[injectHTML]",
// })
// export class InjectHTMLDirective implements OnInit {
//   @Input() set injectHTML(content: string) {
//     this.host.nativeElement.innerHTML = content;
//   }

//   //--- Injectables
//   private host: ElementRef = inject(ElementRef);
//   private injector: Injector = inject(Injector);

//   /**
//    * @name          ngOnInit
//    * @description   Called when component is initialize
//    * @returns       {void}
//    */
//   public ngOnInit(): void {
//     if (!customElements.get("slms-answer-box")) {
//       customElements.define("slms-answer-box", createCustomElement(AnswerBoxComponent, { injector: this.injector }));
//     }
//   }
// }
