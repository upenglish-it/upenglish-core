/**
 * Box Ticking Component (v2)
 *
 * @description Table-style single-choice: multiple rows, each with question + columns (A,B,C,D).
 * Teacher sets correct answer per row; student selects one per row.
 */

import { NgClass } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { TagModule } from "primeng/tag";
import { EditorComponent } from "../../../editor/editor.component";
import { BoxTickingRowFormGroup } from "../../../../form-group/test-variation-part-item-form.form-group";

@Component({
  selector: "slms-box-ticking",
  templateUrl: "./box-ticking.component.html",
  styleUrl: "./box-ticking.component.less",
  imports: [
    NgClass,
    ReactiveFormsModule,
    NzButtonModule,
    NzRadioModule,
    NzInputModule,
    NzInputNumberModule,
    NzToolTipModule,
    TagModule,
    EditorComponent,
  ],
})
export class BoxTickingComponent {
  @Input({ alias: "form-group", required: true }) formGroup: FormGroup;
  @Input({ alias: "item-index", required: true }) itemIndex: number;
  @Input({ alias: "item-form-group", required: true }) itemFormGroup: FormGroup;
  @Input({ alias: "part-form-group", required: true }) partFormGroup: FormGroup;

  public get descriptionFormControl(): FormControl {
    return this.itemFormGroup.get("description") as FormControl;
  }

  public get boxTickingEditorId(): string {
    return `${this.itemFormGroup.value.id}-box-ticking-desc`;
  }

  public get editorMode(): "editing" | "viewing" {
    const m = this.formGroup?.value?.stateSettings?.mode;
    return m === "editing" ? "editing" : "viewing";
  }

  public get choicesFormArray(): FormArray {
    return this.itemFormGroup.get("choices") as FormArray;
  }

  public get rowsFormArray(): FormArray {
    return this.itemFormGroup.get("boxTickingRows") as FormArray;
  }

  public rowFormGroup(rowIndex: number): FormGroup {
    return this.rowsFormArray.controls[rowIndex] as FormGroup;
  }

  public addRow(): void {
    this.rowsFormArray.push(BoxTickingRowFormGroup());
  }

  public removeRow(rowIndex: number): void {
    if (this.rowsFormArray.length > 1) {
      this.rowsFormArray.removeAt(rowIndex);
    }
  }

  public get correctRowCount(): number {
    const score = this.itemFormGroup.get("score")?.value;
    return score || 0;
  }

  public get totalRowCount(): number {
    return this.rowsFormArray?.length ?? 0;
  }
}
