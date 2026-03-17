/**
 * Drag-to-Fill Component
 *
 * @file          drag-to-fill.component.ts
 * @description   Handles drag-to-fill items: editor with blanks, click blank to configure (modal),
 *                student view with drop zones and draggable options. Kept separate from fill-in
 *                to avoid conflicts with fill-in-input behaviour.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { ulid } from "ulidx";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzModalModule } from "ng-zorro-antd/modal";
import { EditorComponent } from "../../../editor/editor.component";
import { EditorComponentRendererDirective } from "../../directives/editor-component-renderer/editor-component-renderer.directive";
import { DragToFillBlankI } from "../../../../form-group/test-variation-part-item.form-group";

@Component({
  selector: "slms-drag-to-fill",
  templateUrl: "./drag-to-fill.component.html",
  styleUrl: "./drag-to-fill.component.less",
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzInputModule,
    NzButtonModule,
    NzInputNumberModule,
    NzModalModule,
    EditorComponentRendererDirective,
    EditorComponent,
  ],
})
export class DragToFillComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ alias: "item-index", required: true }) itemIndex: number;
  @Input({ alias: "form-group", required: true }) formGroup: FormGroup;
  @Input({ alias: "item-form-group", required: true }) itemFormGroup: FormGroup;
  @Input({ alias: "part-form-group", required: true }) partFormGroup: FormGroup;

  @ViewChild("dragToFillContainer", { static: false }) private dragToFillContainer?: ElementRef<HTMLDivElement>;
  private _cachedDragToFillOptions: string[] | null = null;
  private _configuredBlanksSub: { unsubscribe(): void } | null = null;

  /** Modal when clicking a blank (keyed by blank id). */
  public blankConfigModalVisible = false;
  public selectedBlankId: string | null = null;
  public blankConfigFormGroup = new FormGroup({
    correctAnswer: new FormControl<string>(""),
    caseSensitive: new FormControl<boolean>(false),
    points: new FormControl<number>(1),
  });

  public ngOnInit(): void {
    const answers = this.getOriginalAnswersArray();
    this.itemFormGroup.get("originalAnswer").setValue(answers);
  }

  public ngOnDestroy(): void {
    this._configuredBlanksSub?.unsubscribe();
  }

  public ngAfterViewInit(): void {
    this.transformBlanksToDropZonesForStudent();
    this.setupConfiguredBlankIndicators();
  }

  /** Mark blanks that have correct answers so the teacher sees which are configured. */
  private setupConfiguredBlankIndicators(): void {
    const run = (delay = 0) => setTimeout(() => this.applyConfiguredBlankIndicators(), delay);
    run(50);
    this._configuredBlanksSub = this.itemFormGroup.get("dragToFillBlanks")?.valueChanges?.subscribe?.(() => run()) ?? null;
  }

  private applyConfiguredBlankIndicators(): void {
    const editorId = this.itemFormGroup.value.id;
    if (!editorId) return;
    const editorEl = document.getElementById(editorId);
    if (!editorEl) return;
    const configuredIds = new Set(
      this.getDragToFillBlanks()
        .filter((b) => (b.correctAnswers?.length ?? 0) > 0)
        .map((b) => b.id)
    );
    editorEl.querySelectorAll<HTMLSpanElement>("span.slms-fill-input-blank").forEach((span) => {
      const id = span.getAttribute("data-blank-id");
      if (id && configuredIds.has(id)) {
        span.classList.add("slms-fill-input-blank--configured");
      } else {
        span.classList.remove("slms-fill-input-blank--configured");
      }
    });
  }

  private transformBlanksToDropZonesForStudent(): void {
    const mode = this.formGroup?.value?.stateSettings?.mode;
    const action = this.formGroup?.value?.stateSettings?.action;
    if (mode !== "viewing" || action !== "student-answering") return;

    const container = this.dragToFillContainer?.nativeElement;
    if (!container) return;

    const spans = Array.from(container.querySelectorAll("span.slms-fill-input-blank")) as HTMLSpanElement[];
    const currentAnswers: string[] = Array.isArray(this.itemFormGroup.value.participantAnswer) ? [...this.itemFormGroup.value.participantAnswer] : [];

    spans.forEach((span, index) => {
      const dropZone = document.createElement("span");
      dropZone.className =
        "slms-drag-to-fill-dropzone mx-2 inline-block min-w-[4rem] rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 align-baseline text-sm text-slate-600 transition-colors";
      dropZone.setAttribute("data-blank-index", String(index));
      const value = currentAnswers[index] ?? "";
      dropZone.textContent = value || "drop here";

      dropZone.addEventListener("dragover", (e: Event) => {
        e.preventDefault();
        (e as DragEvent).dataTransfer!.dropEffect = "move";
        dropZone.classList.remove("border-slate-300", "bg-slate-50");
        dropZone.classList.add("border-indigo-400", "bg-indigo-100");
      });
      dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("border-indigo-400", "bg-indigo-100");
        dropZone.classList.add("border-slate-300", "bg-slate-50");
      });
      dropZone.addEventListener("drop", (e: Event) => {
        e.preventDefault();
        dropZone.classList.remove("border-indigo-400", "bg-indigo-100");
        dropZone.classList.add("border-slate-300", "bg-slate-50");
        const ev = e as DragEvent;
        const text = ev.dataTransfer?.getData("text/plain") ?? "";
        if (!text) return;
        const answers = Array.isArray(this.itemFormGroup.value.participantAnswer) ? [...this.itemFormGroup.value.participantAnswer] : [];
        answers[index] = text;
        this.itemFormGroup.get("participantAnswer").setValue(answers);
        dropZone.textContent = text;
      });

      span.replaceWith(dropZone);
    });
  }

  public getDragToFillOptions(): string[] {
    if (this._cachedDragToFillOptions !== null) return this._cachedDragToFillOptions;
    const raw = this.itemFormGroup.value.originalAnswer;
    if (!Array.isArray(raw)) return [];
    const set = new Set<string>();
    raw.forEach((entry: string) => {
      (entry ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .forEach((s) => set.add(s));
    });
    const arr = Array.from(set);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    this._cachedDragToFillOptions = arr;
    return arr;
  }

  public onDragToFillOptionDragStart(ev: DragEvent, option: string): void {
    if (!ev.dataTransfer) return;
    ev.dataTransfer.effectAllowed = "move";
    ev.dataTransfer.setData("text/plain", option);
  }

  public getViewFillInHTML(): string {
    return this.buildFilledHtmlForResults();
  }

  private buildFilledHtmlForResults(): string {
    const html: string = this.itemFormGroup.value.dragToFillContent || "";
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const blanks = Array.from(temp.querySelectorAll("span.slms-fill-input-blank")) as HTMLSpanElement[];
    const participantAnswers: string[] = Array.isArray(this.itemFormGroup.value.participantAnswer) ? this.itemFormGroup.value.participantAnswer : [];

    blanks.forEach((span, index) => {
      const value = participantAnswers[index] ?? "";
      span.textContent = value || span.textContent || "";
      span.setAttribute("contenteditable", "false");
      span.style.display = "inline-block";
      span.style.minWidth = "2rem";
      span.style.padding = "0.15rem 0.5rem";
      span.style.margin = "0 0.1rem";
      span.style.border = "1px solid #4f46e5";
      span.style.borderRadius = "0.25rem";
      span.style.backgroundColor = "#eef2ff";
      span.style.color = "#312e81";
      span.style.fontWeight = "600";
    });
    return temp.innerHTML;
  }

  private getOriginalAnswersArray(): string[] {
    const raw = this.itemFormGroup.value.originalAnswer;
    if (Array.isArray(raw)) return [...raw];
    if (typeof raw === "string" && raw.trim().length > 0) return [raw];
    return [];
  }

  private getDragToFillBlanks(): DragToFillBlankI[] {
    const v = this.itemFormGroup.get("dragToFillBlanks")?.value;
    return Array.isArray(v) ? v : [];
  }

  /** Sync originalAnswer from dragToFillBlanks so getDragToFillOptions and backend stay in sync. */
  private syncOriginalAnswerFromBlanks(): void {
    const blanks = this.getDragToFillBlanks();
    const html = this.itemFormGroup.value.dragToFillContent ?? "";
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const spanBlanks = Array.from(temp.querySelectorAll("span.slms-fill-input-blank"));
    const ordered: string[] = spanBlanks.map((span) => {
      const id = span.getAttribute("data-blank-id");
      const entry = blanks.find((b) => b.id === id);
      const first = entry?.correctAnswers?.[0] ?? "";
      return first.trim();
    });
    this.itemFormGroup.get("originalAnswer").setValue(ordered);
    this._cachedDragToFillOptions = null;
  }

  public onEditorAreaClick(ev: Event): void {
    const target = ev.target as HTMLElement;
    const blank = target.closest?.("span.slms-fill-input-blank") as HTMLElement | null;
    if (!blank) return;
    ev.preventDefault();
    ev.stopPropagation();
    const blankId = blank.getAttribute("data-blank-id");
    if (!blankId) return;
    this.openBlankConfigModal(blankId);
  }

  public openBlankConfigModal(blankId: string): void {
    let blanks = this.getDragToFillBlanks();
    let entry = blanks.find((b) => b.id === blankId);
    if (!entry) {
      entry = {
        id: blankId,
        participantAnswer: "",
        correctAnswers: [],
        caseSensitive: !!this.itemFormGroup.value.fillInputCaseSensitive,
        points: 1,
      };
      blanks = [...blanks, entry];
      this.itemFormGroup.get("dragToFillBlanks").setValue(blanks);
    }
    this.selectedBlankId = blankId;
    this.blankConfigFormGroup.patchValue({
      correctAnswer: (entry.correctAnswers ?? [])[0] ?? "",
      caseSensitive: entry.caseSensitive ?? false,
      points: entry.points ?? 1,
    });
    this.blankConfigModalVisible = true;
  }

  public closeBlankConfigModal(): void {
    this.blankConfigModalVisible = false;
    this.selectedBlankId = null;
  }

  public saveBlankConfig(): void {
    if (this.selectedBlankId == null) return;
    const blanks = this.getDragToFillBlanks();
    const v = this.blankConfigFormGroup.value;
    const correctAnswer = (v.correctAnswer ?? "").trim();
    const correctAnswers = correctAnswer ? [correctAnswer] : [];

    const idx = blanks.findIndex((b) => b.id === this.selectedBlankId);
    if (idx === -1) return;
    blanks[idx] = {
      ...blanks[idx],
      correctAnswers,
      caseSensitive: v.caseSensitive ?? false,
      points: v.points ?? 1,
    };
    this.itemFormGroup.get("dragToFillBlanks").setValue([...blanks]);
    this.syncOriginalAnswerFromBlanks();
    this.closeBlankConfigModal();
  }

  public getTotalPoints(): number {
    return this.getDragToFillBlanks().reduce((sum, b) => sum + (b.points ?? 0), 0);
  }

  public isBlankAnswerWrong(index: number): boolean {
    const participantAnswers = this.itemFormGroup.value.participantAnswer;
    if (!Array.isArray(participantAnswers) || participantAnswers[index] == null) return false;
    const studentAnswer = String(participantAnswers[index] ?? "").trim();
    const correctList = this.getOriginalAnswersArray();
    const correct = (correctList[index] ?? "").trim();
    const caseSensitive = !!this.itemFormGroup.value.fillInputCaseSensitive;
    if (caseSensitive) return studentAnswer !== correct;
    return studentAnswer.toLowerCase() !== correct.toLowerCase();
  }

  public getCorrectAnswerForBlank(index: number): string {
    const correctList = this.getOriginalAnswersArray();
    return (correctList[index] ?? "").trim();
  }

  /** Form control for the passage HTML (dragToFillContent). */
  public get dragToFillContentFormControl(): FormControl {
    return this.itemFormGroup.get("dragToFillContent") as FormControl;
  }
}
