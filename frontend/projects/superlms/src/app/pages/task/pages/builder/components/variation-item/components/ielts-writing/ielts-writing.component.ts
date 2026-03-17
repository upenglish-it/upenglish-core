/**
 * IELTS Writing Component
 *
 * @file          ielts-writing.component
 * @description   This component handles the IELTS writing variation item.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Component, inject, Input } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
//--- NG Zorro
import { NzInputModule } from "ng-zorro-antd/input";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
//--- Prime NG
import { EditorModule } from "primeng/editor";
import { NzSelectModule } from "ng-zorro-antd/select";
import { BuilderService } from "@superlms/services/builder/builder.service";
import { PromptI } from "@superlms/models/prompts/prompts.endpoints.datatypes";

@Component({
  selector: "slms-ielts-writing",
  templateUrl: "./ielts-writing.component.html",
  styleUrl: "./ielts-writing.component.less",
  imports: [
    //--- NG Modules
    ReactiveFormsModule,
    //--- NG Zorro
    NzRadioModule,
    NzInputModule,
    NzSelectModule,
    NzToolTipModule,
    NzInputNumberModule,
    //--- Prime NG
    EditorModule,
  ],
})
export class IELTSWritingComponent {
  //--- Input
  @Input({ alias: "item-index", required: true }) itemIndex: number;
  @Input({ alias: "form-group", required: true }) formGroup: FormGroup;
  @Input({ alias: "item-form-group", required: true }) itemFormGroup: FormGroup;
  @Input({ alias: "part-form-group", required: true }) partFormGroup: FormGroup;

  //--- Injectables
  public readonly builderService: BuilderService = inject(BuilderService);

  readonly compareFn = (o1: PromptI, o2: PromptI): boolean => (o1 && o2 ? o1._id === o2._id : o1 === o2);
}
