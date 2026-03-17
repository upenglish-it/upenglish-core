/**
 * IELTS Speaking Component
 *
 * @file          ielts-speaking.component
 * @description   This component handles the IELTS speaking variation item.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Component, Input, ViewChild } from "@angular/core";
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

@Component({
  selector: "slms-speaking",
  templateUrl: "./speaking.component.html",
  styleUrl: "./speaking.component.less",
  imports: [
    //--- NG Modules
    ReactiveFormsModule,
    //--- NG Zorro
    NzRadioModule,
    NzInputModule,
    NzButtonModule,
    NzToolTipModule,
    NzInputNumberModule,
    //--- Prime NG
    EditorModule,
    //--- Components
    AudioSelectorComponent,
  ],
})
export class SpeakingComponent {
  //--- View Child
  @ViewChild("waveform") public waveformContainer!: any;

  //--- Input
  @Input({ alias: "item-index", required: true }) itemIndex: number;
  @Input({ alias: "form-group", required: true }) formGroup: FormGroup;
  @Input({ alias: "item-form-group", required: true }) itemFormGroup: FormGroup;
  @Input({ alias: "part-form-group", required: true }) partFormGroup: FormGroup;
}
