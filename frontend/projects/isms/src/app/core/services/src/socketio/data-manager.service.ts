import { Injectable } from "@angular/core";
import { SoundKeys } from "@isms-core/constants";
import { SoundService } from "../sound.service";

@Injectable({
  providedIn: "root",
})
export class DataManagerService {
  public inboxes: Array<any> = [];

  constructor(private readonly soundService: SoundService) {}

  public newMessageFromCandidate(data: any): void {
    this.soundService.play(SoundKeys.Notification);
  }
}
