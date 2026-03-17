/**
 * Table Box Component
 *
 * @file          table-box.component
 * @description   This component is responsible for rendering a table box
 * @author        John Mark Alicante
 * @since         2025 - 10 - 21
 */

//--- NG Modules
import { AfterViewInit, Component, ElementRef, inject, Input } from "@angular/core";
import { FormArray, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
//--- Ulidx
import { ulid } from "ulidx";
//--- Types
export type ViewTypeT = "radio" | "input";
export type ToEditT = "questions" | "answer-options";
//--- Constants
import { SYSTEM_ID } from "@isms-core/utils";
//--- Interfaces
export interface QuestionI {
  id: string;
  question: string;
  correctAnswer: string;
  studentAnswer: string;
  points: number;
  answerOptions?: AnswerChoiceI[];
}
export interface AnswerChoiceI {
  id: string;
  title: string;
  answerValue: string;
}
//--- Forms
export const QuestionFormGroup = (question: QuestionI | null) => {
  return new FormGroup({
    id: new FormControl<string>(question?.id || SYSTEM_ID(), { nonNullable: true, validators: [Validators.required] }),
    question: new FormControl<string>(question?.question || "", { nonNullable: true, validators: [Validators.required] }),
    correctAnswer: new FormControl<string>(question?.correctAnswer || "", { nonNullable: true, validators: [Validators.required] }),
    studentAnswer: new FormControl<string>(question?.studentAnswer || ""),
    points: new FormControl<number>(question?.points || 0, { nonNullable: true, validators: [Validators.required] }),
    answerOptions: new FormArray([]), //--- Used for table->input view type
  });
};
export const AnswerChoiceFormGroup = (answerChoices: AnswerChoiceI | null) => {
  return new FormGroup({
    id: new FormControl<string>(answerChoices?.id || SYSTEM_ID(), { nonNullable: true, validators: [Validators.required] }),
    title: new FormControl<string>(answerChoices?.title || "", { nonNullable: true, validators: [Validators.required] }),
    answerValue: new FormControl<string>(answerChoices?.answerValue || ""),
  });
};
//--- NG Zorro
import { NzInputModule } from "ng-zorro-antd/input";
import { NzButtonModule } from "ng-zorro-antd/button";
import { RadioButtonModule } from "primeng/radiobutton";
//--- Components

@Component({
  selector: "slms-table-box-input-box",
  imports: [
    //--- NG Modules
    FormsModule,
    ReactiveFormsModule,
    //--- NG Zorro
    NzInputModule,
    NzButtonModule,
    //--- Primeng NG
    RadioButtonModule,
  ],
  templateUrl: "./table-box-input-box.component.html",
  styleUrl: "./table-box-input-box.component.less",
})
export class TableBoxInputBoxComponent implements AfterViewInit {
  //--- Injectables
  private elementRef: ElementRef = inject(ElementRef);

  //--- Input
  @Input({ alias: "view-mode", required: true }) public viewMode: "editing" | "viewing";

  //--- Public
  public viewType: ViewTypeT;
  public elementId: string = ulid();
  public element: HTMLElement | null = null;

  /**
   * @name          ngAfterViewInit
   * @description   Called after the view has been initialized
   * @returns       {void}
   */
  public ngAfterViewInit(): void {
    console.log("TableBoxInputBoxComponent initialized", this.elementRef?.nativeElement);
    if (this.elementRef.nativeElement) {
      this.element = this.elementRef.nativeElement as HTMLElement;
    }

    // if (this.element.getAttribute("view-type")) {
    //   this.viewType = this.element.getAttribute("view-type") as ViewTypeT;
    // }

    // if (this.element.getAttribute("table-title")) {
    //   this.tableTitleFormControl.setValue(this.element.getAttribute("table-title"));
    // }

    // if (this.element.getAttribute("questions")) {
    //   const questions = JSON.parse(this.element.getAttribute("questions")) as QuestionI[];
    //   for (const question of questions) {
    //     const formGroup = QuestionFormGroup(question);

    //     //--- Populate answer options if available
    //     question.answerOptions?.forEach((answerOption) => {
    //       const answerOptionFormGroup = AnswerChoiceFormGroup(answerOption);
    //       (formGroup.get("answerOptions") as FormArray).push(answerOptionFormGroup);
    //     });

    //     this.questionsFormArray.push(formGroup);
    //   }
    // }

    // if (this.element.getAttribute("answer-choices")) {
    //   const answerChoices = JSON.parse(this.element.getAttribute("answer-choices")) as AnswerChoiceI[];
    //   for (const answerChoice of answerChoices) {
    //     const formGroup = AnswerChoiceFormGroup(answerChoice);
    //     if (this.viewType === "radio") {
    //       formGroup.get("answerValue")?.setValidators([Validators.required]);
    //     }
    //     this.answerChoicesFormArray.push(formGroup);
    //   }
    // }

    // //--- Listen to every changes of the form
    // this.tableTitleFormControl.valueChanges.pipe(distinctUntilChanged(), debounceTime(200)).subscribe((value) => {
    //   this.element.setAttribute("table-title", value);
    // });
    // this.questionsFormArray.valueChanges.pipe(distinctUntilChanged(), debounceTime(200)).subscribe((value) => {
    //   this.element.setAttribute("questions", JSON.stringify(value));
    // });
    // this.answerChoicesFormArray.valueChanges.pipe(distinctUntilChanged(), debounceTime(200)).subscribe((value) => {
    //   this.element.setAttribute("answer-choices", JSON.stringify(value));
    // });

    // setInterval(() => {
    //   console.log("Questions:", this.questionsFormArray.value);
    //   console.log("Answer Choices:", this.answerChoicesFormArray.value);
    // }, 2000);
  }

  /**
   * @name          participantTypedAnswer
   * @description   Set the participant's answer for the movable textbox
   * @param         {string} answer
   * @returns       {void}
   */
  public participantTypedAnswer(answer: string): void {
    if (this.viewMode === "viewing") {
      this.element.setAttribute("participant-answer", answer);
    }
  }

  /**
   * @name          delete
   * @description   Delete element
   * @returns       {void}
   */
  public delete(): void {
    this.element.remove();
  }
}
