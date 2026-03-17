/**
 * Audio Selector Component
 *
 * @file          audio-selector.component
 * @description   This component allows the teacher to select an audio file from the library.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { FormGroup } from "@angular/forms";
import { Component, ElementRef, inject, Input, OnInit, signal, ViewChild, WritableSignal } from "@angular/core";
//--- Wave Surfer
import WaveSurfer from "wavesurfer.js";
//--- RecordRTC
import RecordRTC from "recordrtc";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
//--- NG Zorro
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzMessageService } from "ng-zorro-antd/message";

@Component({
  selector: "slms-audio-selector",
  imports: [
    //--- NG Zorro
    NzButtonModule,
  ],
  templateUrl: "./audio-selector.component.html",
  styleUrl: "./audio-selector.component.less",
})
export class AudioSelectorComponent implements OnInit {
  //--- Input
  @Input({ alias: "item-form-group", required: true }) itemFormGroup: FormGroup;
  @Input({ alias: "form-control-name", required: true }) formControlName: string | null = null;
  @Input({ alias: "can-record", required: true }) canRecord: boolean = true;

  //--- View Child
  @ViewChild("waveform") public waveformContainer!: ElementRef<HTMLDivElement>;

  //--- Injectables
  private readonly apiService: ApiService = inject(ApiService);
  public nzMessageService: NzMessageService = inject(NzMessageService);

  //--- Public
  public waveSurfer: WaveSurfer;
  public showSaveButton: WritableSignal<boolean> = signal<boolean>(false);
  public audioUrl: WritableSignal<string | null> = signal<string | null>(null);
  public isRecording: WritableSignal<boolean> = signal<boolean>(false);

  //--- Private
  private stream: MediaStream;
  private recordRTC: RecordRTC;

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {}

  /**
   * @name          ngAfterContentInit
   * @description   Called after content has been initialized
   * @returns       {void}
   */
  public ngAfterViewInit(): void {
    this.loadAudio();
  }

  public loadAudio(): void {
    if (this.itemFormGroup.get(this.formControlName)?.value) {
      this.audioUrl.set(this.itemFormGroup.get(this.formControlName)?.value);
      this.createWaveSurfer();
    }
  }

  /**
   * @name          startRecording
   * @description   Called to start recording
   * @returns       {void}
   */
  public startRecording(): void {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(
      (stream: MediaStream) => this.successCallback(stream),
      (error: any) => this.errorCallback(error)
    );
  }

  private successCallback(stream: MediaStream): void {
    const options: RecordRTC.Options = {
      type: "audio",

      // mimeType: "audio/wav",

      // both for audio and video tracks
      bitsPerSecond: 128000,

      // only for audio track
      // ignored when codecs=pcm
      audioBitsPerSecond: 128000,
      // used by StereoAudioRecorder
      // the range 22050 to 96000.
      sampleRate: 96000,

      // used by StereoAudioRecorder
      // the range 22050 to 96000.
      // let us force 16khz recording:
      desiredSampRate: 16000,

      // used by StereoAudioRecorder
      // Legal values are (256, 512, 1024, 2048, 4096, 8192, 16384).
      bufferSize: 16384,

      // used by StereoAudioRecorder
      // 1 or 2
      numberOfAudioChannels: 2,
    };
    this.stream = stream;
    this.recordRTC = new RecordRTC(stream, options);
    this.recordRTC.startRecording();
    this.isRecording.set(true);
  }

  private errorCallback(error: any): void {
    //handle error here
  }

  private processVideo(): void {
    const blob = this.recordRTC.getBlob();
    const dataURL = URL.createObjectURL(blob);
    console.log("blob: ", blob, this.recordRTC.getBlob(), this.recordRTC.toURL(), this.recordRTC.getInternalRecorder());
    // this.recordRTC.getBlob().then((blob: Blob) => {
    this.isRecording.set(false);
    console.log("dataURL: ", dataURL, this);
    this.audioUrl.set(dataURL);
    this.showSaveButton.set(true);
    this.createWaveSurfer();
    // });
  }

  public recordAgain(): void {
    this.waveSurfer.destroy();
    this.audioUrl.set(null);
    this.recordRTC.reset();
  }

  /**
   * Stop recording
   */
  public stopRecording(): void {
    this.recordRTC.stopRecording(() => this.processVideo());
    this.stream.getAudioTracks().forEach((track: MediaStreamTrack) => track.stop());
    this.stream.getVideoTracks().forEach((track: MediaStreamTrack) => track.stop());
  }

  private createWaveSurfer(): void {
    if (this.waveSurfer) {
      this.waveSurfer.destroy();
    }
    this.waveSurfer = WaveSurfer.create({
      container: this.waveformContainer.nativeElement,
      height: 24,
      barGap: 2,
      barRadius: 2,
      barWidth: 2,
      waveColor: "#636ae8", // $gray-300
      progressColor: "#000000", // $yellow-400
      normalize: true,
      interact: false,
      cursorWidth: 0,
      url: this.audioUrl(),
    });
  }

  public play(): void {
    if (this.waveSurfer.isPlaying()) {
      this.waveSurfer.pause();
    } else {
      this.waveSurfer.play();
    }
  }

  public async saveAudio(): Promise<void> {
    const formData: FormData = new FormData();
    formData.append("file", this.recordRTC.getBlob());
    this.apiService.endPointsC.fileManager.post
      .upload(this.apiService, formData)
      .then((res) => {
        if (res.success) {
          this.itemFormGroup.get(this.formControlName)?.setValue(res.data[0].data.cdn);
          this.nzMessageService.success(`Audio saved successfully`);
          this.showSaveButton.set(false);
        }
      })
      .finally(() => {});
  }

  // private blobToBase64(blob: Blob): Promise<string> {
  //   return new Promise((resolve, _) => {
  //     const reader = new FileReader();
  //     reader.onloadend = () => resolve(reader.result as any);
  //     reader.readAsDataURL(blob);
  //   });
  // }
}
