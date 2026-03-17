import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

@Injectable()
export class LoaderService {
  isLoading: Subject<boolean>;

  constructor() {
    this.isLoading = new Subject<boolean>();
  }

  show(): void {
    this.isLoading.next(true);
  }

  hide(): void {
    this.isLoading.next(false);
  }
}
