/**
 * Create Task Modal Component
 *
 * @file          create-task-modal.component
 * @description   Modal for creating tasks
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Component, Input, OnInit } from "@angular/core";
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
//--- NG Zorro
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
//--- Utils
import { SYSTEM_ID } from "@isms-core/utils";
//--- Components
import { TableBoxAnswerChoiceEditorComponent } from "../table-box-answer-choice-editor/table-box-answer-choice-editor.component";
import { AnswerChoiceFormGroup, AnswerChoiceI, QuestionFormGroup, ToEditT } from "../table-box/table-box.component";

@Component({
  selector: "slms-table-box-config-modal",
  imports: [
    //--- NG Modules
    ReactiveFormsModule,
    //--- NG Zorro
    NzInputModule,
    NzModalModule,
    NzButtonModule,
    NzSelectModule,
    NzInputNumberModule,
    //--- Components
    TableBoxAnswerChoiceEditorComponent,
  ],
  templateUrl: "./table-box-config-modal.component.html",
  styleUrl: "./table-box-config-modal.component.less",
})
export class AnswerBoxConfigModalComponent implements OnInit {
  //--- Input
  @Input({ alias: "questions-form-array", required: true }) public questionsFormArray: FormArray;

  //--- Input
  @Input({ alias: "answer-choices-form-array", required: true }) public answerChoicesFormArray: FormArray;
  @Input({ alias: "view-type", required: true }) public viewType: "radio" | "input";

  //--- Public
  public toEdit: ToEditT;

  //--- Public
  public showModal: boolean = false;

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {}

  /**
   * @name          toggle
   * @description   Toggles the visibility of the create task modal
   * @returns       {void}
   */
  public toggle(): void {
    this.showModal = !this.showModal;
  }

  /**
   * @name          toggle
   * @description   Toggles the visibility of the create task modal
   * @returns       {void}
   */
  public setToEdit(toEdit: ToEditT): void {
    this.toEdit = toEdit;
  }

  /**
   * @name          setValue
   * @description   Sets the form values
   * @param         {AnswerChoiceI[]} answerChoices
   * @returns       {void}
   */
  public setValue(answerChoices: AnswerChoiceI[]): void {
    this.answerChoicesFormArray.clear();
    answerChoices.forEach((answerChoice: AnswerChoiceI) => {
      this.answerChoicesFormArray.push(
        new FormGroup({
          title: new FormControl(answerChoice.title, [Validators.required]),
          answerValue: new FormControl(answerChoice.answerValue, [Validators.required]),
        })
      );
    });
  }

  /**
   * @name          submit
   * @description   Submits the form data
   * @returns       {void}
   */
  public submit(): void {
    if (this.toEdit === "questions") {
      this.questionsFormArray.markAllAsTouched();
      if (this.questionsFormArray.valid) {
      }
      this.toggle();
    }

    if (this.toEdit === "answer-options") {
      this.answerChoicesFormArray.markAllAsTouched();
      if (this.answerChoicesFormArray.valid) {
        this.toggle();
      }
    }
  }

  /**
   * @name          addQuestion
   * @description   Add question in table
   * @returns       {void}
   */
  public addQuestion(): void {
    console.log("addQuestion ", this.answerChoicesFormArray.length);

    const questionFormGroup = QuestionFormGroup({
      id: SYSTEM_ID(),
      question: "Untitled Question",
      correctAnswer: "",
      studentAnswer: "",
      points: 0,
    });
    const answerOptionsFormArray = questionFormGroup.get("answerOptions") as FormArray;

    this.answerChoicesFormArray.controls.forEach((answerChoiceFormGroup: AbstractControl) => {
      answerOptionsFormArray.push(answerChoiceFormGroup);
    });

    this.questionsFormArray.push(questionFormGroup);
  }
  /**
   * @name          addQuestions
   * @description   Add question in table
   * @returns       {void}
   */
  public addAnswerChoices(): void {
    const formGroup = AnswerChoiceFormGroup({
      id: SYSTEM_ID(),
      title: "Untitled",
      answerValue: "",
    });

    if (this.viewType === "radio") {
      formGroup.get("answerValue")?.setValidators([Validators.required]);
    }

    this.answerChoicesFormArray.push(formGroup);

    if (this.viewType === "input") {
      //--- Populate answer options if available
      //  question.answerOptions?.forEach((answerOption) => {
      //    const answerOptionFormGroup = AnswerChoiceFormGroup(answerOption);
      //    (formGroup.get("answerOptions") as FormArray).push(answerOptionFormGroup);
      //  });

      this.questionsFormArray.controls.forEach((questionFormGroup: AbstractControl) => {
        const answerOptionsFormArray = questionFormGroup.get("answerOptions") as FormArray;

        const answerOptionFormGroup = AnswerChoiceFormGroup({
          id: SYSTEM_ID(),
          title: "Untitled",
          answerValue: "",
        });
        answerOptionsFormArray.push(answerOptionFormGroup);
      });
    }
  }

  /**
   * @name          toFormGroup
   * @description   Converts AbstractControl to FormGroup
   * @param         {AbstractControl} formGroup
   * @returns       {FormGroup}
   */
  public toFormGroup(formGroup: AbstractControl): FormGroup {
    return formGroup as FormGroup;
  }

  /**
   * @name          toFormControl
   * @description   Converts AbstractControl to FormControl
   * @param         {AbstractControl} formGroup
   * @param         {string} formControlField
   * @returns       {FormControl}
   */
  public toFormControl(formGroup: AbstractControl, formControlField: string): FormControl {
    return formGroup.get(formControlField) as FormControl;
  }

  /**
   * @name          questionAnswerChoicesFormArray
   * @description   Get answer choices form array for a question
   * @param         {number} index
   * @returns       {FormArray}
   */
  public questionAnswerChoicesFormArray(index: number): FormArray {
    return this.questionsFormArray.at(index).get("answerOptions") as FormArray;
  }
}
