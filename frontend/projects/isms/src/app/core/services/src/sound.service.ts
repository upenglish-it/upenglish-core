import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class SoundService {
  public play(data: { elementId: string; fileUrl: string }, options?: { muted?: boolean; loop?: boolean }): void {
    const audio = document.createElement("audio");
    audio.style.display = "none";
    audio.id = data.elementId;
    audio.src = data.fileUrl;
    audio.loop = options?.loop ? true : false;
    audio.muted = options?.muted ? true : false;
    audio.autoplay = true;
    audio.onended = () => {
      audio.remove(); //Remove when played.
    };
    document.body.appendChild(audio);
  }

  public stop(elementId: string): void {
    const audio = document.getElementById(elementId);
    if (audio) {
      audio.remove();
    }
  }
}
