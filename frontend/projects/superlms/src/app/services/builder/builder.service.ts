import { Injectable, signal } from "@angular/core";
import { PromptI } from "@superlms/models/prompts/prompts.endpoints.datatypes";

@Injectable({
  providedIn: "root",
})
export class BuilderService {
  private prompts = signal<PromptI[]>([]);
  public prompts$ = this.prompts.asReadonly();

  /**
   * @name          loadData
   * @description   Load the data for the component
   * @returns       {void}
   */
  public setPrompts(prompts: PromptI[]): void {
    console.log("prompts", prompts);
    this.prompts.set(prompts);
  }
}
