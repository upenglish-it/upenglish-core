import { Component, Input, ViewEncapsulation } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
//--- NG Zorro
import { NzInputModule } from "ng-zorro-antd/input";
//--- Prime NG
import { EditorModule } from "primeng/editor";

@Component({
  selector: "slms-instruction",
  templateUrl: "./instruction.component.html",
  styleUrl: "./instruction.component.less",
  encapsulation: ViewEncapsulation.None,
  imports: [
    //--- NG Modules
    ReactiveFormsModule,
    //--- NG Zorro
    NzInputModule,
    //--- Prime NG
    EditorModule,
  ],
})
export class InstructionComponent {
  @Input({ alias: "form-group", required: true }) formGroup: FormGroup;
  @Input({ alias: "item-form-group", required: true }) itemFormGroup: FormGroup;
}
