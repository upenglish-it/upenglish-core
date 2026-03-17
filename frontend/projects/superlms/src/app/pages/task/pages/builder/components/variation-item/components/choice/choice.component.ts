import { NgClass } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
//--- ULIDX
import { ulid } from "ulidx";
//--- NG Zorro
import { NzInputModule } from "ng-zorro-antd/input";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
//--- Prime NG
import { TagModule } from "primeng/tag";
import { EditorModule } from "primeng/editor";
//---Forms
import { ChoiceFormGroup } from "../../../../form-group/test-variation-part-item-form.form-group";
import { ChoiceItem } from "../../../../form-group/test-variation-part-item.form-group";

@Component({
  selector: "slms-choice",
  templateUrl: "./choice.component.html",
  styleUrl: "./choice.component.less",
  imports: [
    //--- NG Modules
    NgClass,
    ReactiveFormsModule,
    //--- NG Zorro
    NzRadioModule,
    NzInputModule,
    NzToolTipModule,
    NzInputNumberModule,
    //--- Prime NG
    TagModule,
    EditorModule,
  ],
})
export class ChoiceComponent {
  @Input({ alias: "form-group", required: true }) formGroup: FormGroup;
  @Input({ alias: "item-index", required: true }) itemIndex: number;
  @Input({ alias: "item-form-group", required: true }) itemFormGroup: FormGroup;

  /**
   * @name          addChoice
   * @description   Add a new choice to the choices form array
   * @returns       {void}
   */
  public addChoice(): void {
    this.choicesFormArray.push(ChoiceFormGroup());
  }

  /**
   * @name          itemsFormArray
   * @description   Get the choices form array
   * @returns       {FormArray}
   */
  public get choicesFormArray(): FormArray {
    return this.itemFormGroup.get("choices") as FormArray;
  }

  /**
   * @name          choiceFormGroup
   * @description   Get the choice form group
   * @returns       {FormGroup}
   */
  public choiceFormGroup(choiceIndex: number): FormGroup {
    return this.choicesFormArray.controls[choiceIndex] as FormGroup;
  }

  /**
   * @name          answerStatus
   * @description   Get the answer status
   * @returns       {boolean}
   */
  public get answerStatus(): boolean {
    const answerId = this.itemFormGroup.value.choices.find((choice: ChoiceItem) => choice.id === this.itemFormGroup.value.originalAnswer)?.id || null;
    return answerId === this.itemFormGroup.value.participantAnswer;
  }
}
