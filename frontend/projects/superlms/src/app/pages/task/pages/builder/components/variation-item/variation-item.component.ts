/**
 * Variation Item Component
 *
 * @file          variation-item.component
 * @description   This component handles the variation item.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Component, Input } from "@angular/core";
import { FormArray, FormGroup } from "@angular/forms";
//--- NG Zorro
import { NzButtonModule } from "ng-zorro-antd/button";
//--- Components
import { ChoiceComponent } from "./components/choice/choice.component";
import { FillInComponent } from "./components/fill-in/fill-in.component";
import { DragToFillComponent } from "./components/drag-to-fill/drag-to-fill.component";
import { DragNDropComponent } from "./components/drag-n-drop/drag-n-drop.component";
import { BoxTickingComponent } from "./components/box-ticking/box-ticking.component";
import { InstructionComponent } from "./components/instruction/instruction.component";
import { IELTSWritingComponent } from "./components/ielts-writing/ielts-writing.component";
import { IELTSSpeakingComponent } from "./components/ielts-speaking/ielts-speaking.component";
import { SpeakingComponent } from "./components/speaking/speaking.component";

@Component({
  selector: "slms-variation-item",
  imports: [
    //--- NG Zorro
    NzButtonModule,
    //--- Components
    FillInComponent,
    DragToFillComponent,
    ChoiceComponent,
    BoxTickingComponent,
    SpeakingComponent,
    DragNDropComponent,
    InstructionComponent,
    IELTSWritingComponent,
    IELTSSpeakingComponent,
  ],
  templateUrl: "./variation-item.component.html",
  styleUrl: "./variation-item.component.less",
})
export class VariationItemComponent {
  @Input({ alias: "form-group", required: true }) formGroup: FormGroup;
  @Input({ alias: "part-form-group", required: true }) partFormGroup: FormGroup;
  @Input({ alias: "item-index", required: true }) itemIndex: number;
  @Input({ alias: "item-form-group", required: true }) itemFormGroup: FormGroup;

  /**
   * @name          itemsFormArray
   * @description   Get the items form array
   * @returns       {FormArray}
   */
  public get itemsFormArray(): FormArray {
    return (this.partFormGroup?.controls["items"] as FormArray) || new FormArray([]);
  }
}
