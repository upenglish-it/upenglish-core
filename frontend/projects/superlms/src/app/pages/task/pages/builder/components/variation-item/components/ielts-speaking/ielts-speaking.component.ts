/**
 * IELTS Speaking Component
 *
 * @file          ielts-speaking.component
 * @description   This component handles the IELTS speaking variation item.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Component, inject, Input, ViewChild } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
//--- NG Zorro
import { NzInputModule } from "ng-zorro-antd/input";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
//--- Prime NG
import { EditorModule } from "primeng/editor";
//--- Wave Surfer
import WaveSurfer from "wavesurfer.js";
import { AudioSelectorComponent } from "../../../editor/components/audio-selector/audio-selector.component";
import { NzSelectModule } from "ng-zorro-antd/select";
import { PromptI } from "@superlms/models/prompts/prompts.endpoints.datatypes";
import { BuilderService } from "@superlms/services/builder/builder.service";

@Component({
  selector: "slms-ielts-speaking",
  templateUrl: "./ielts-speaking.component.html",
  styleUrl: "./ielts-speaking.component.less",
  imports: [
    //--- NG Modules
    ReactiveFormsModule,
    //--- NG Zorro
    NzInputModule,
    NzRadioModule,
    NzSelectModule,
    NzButtonModule,
    NzToolTipModule,
    NzInputNumberModule,
    //--- Prime NG
    EditorModule,
    //--- Components
    AudioSelectorComponent,
  ],
})
export class IELTSSpeakingComponent {
  //--- View Child
  @ViewChild("waveform") public waveformContainer!: any;

  //--- Input
  @Input({ alias: "item-index", required: true }) itemIndex: number;
  @Input({ alias: "form-group", required: true }) formGroup: FormGroup;
  @Input({ alias: "item-form-group", required: true }) itemFormGroup: FormGroup;
  @Input({ alias: "part-form-group", required: true }) partFormGroup: FormGroup;

  //--- Injectables
  public readonly builderService: BuilderService = inject(BuilderService);

  readonly compareFn = (o1: PromptI, o2: PromptI): boolean => (o1 && o2 ? o1._id === o2._id : o1 === o2);
}
