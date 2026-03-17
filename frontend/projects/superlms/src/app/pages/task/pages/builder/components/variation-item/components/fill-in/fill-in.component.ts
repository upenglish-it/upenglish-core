/**
 * Builder Component
 *
 * @file          builder.component
 * @description   This page allows the teacher to create and edit tasks.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
//--- ULIDX
import { ulid } from "ulidx";
//--- Interfaces
interface TextboxI {
  text: string;
  participantAnswerId: string;
  tagName: string;
  id: string;
  styles: string;
  points: string;
}
//--- NG Zorro
import { NzInputModule } from "ng-zorro-antd/input";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzModalModule } from "ng-zorro-antd/modal";
//--- Prime NG
import { EditorModule } from "primeng/editor";
//--- Components
import { EditorComponent } from "../../../editor/editor.component";
//--- Directives
import { EditorComponentRendererDirective } from "../../directives/editor-component-renderer/editor-component-renderer.directive";
@Component({
  selector: "slms-fill-in",
  templateUrl: "./fill-in.component.html",
  styleUrl: "./fill-in.component.less",
  imports: [
    //--- NG Modules
    FormsModule,
    ReactiveFormsModule,
    //--- NG Zorro
    NzRadioModule,
    NzInputModule,
    NzButtonModule,
    NzToolTipModule,
    NzInputNumberModule,
    NzModalModule,
    //--- Prime NG
    EditorModule,
    //--- Directives
    EditorComponentRendererDirective,
    //--- Components
    EditorComponent,
  ],
})
export class FillInComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ alias: "item-index", required: true }) itemIndex: number;
  @Input({ alias: "form-group", required: true }) formGroup: FormGroup;
  @Input({ alias: "item-form-group", required: true }) itemFormGroup: FormGroup;
  @Input({ alias: "part-form-group", required: true }) partFormGroup: FormGroup;

  //--- Public
  // public quill: Quill;
  // public readonly quillModules: any = {
  //   toolbar: {
  //     theme: "bubble",
  //     container: [
  //       ["bold", "italic", "underline", "strike"], // toggled buttons
  //       ["image", "formula"],
  //       ["slms-movable-drag-n-drop-textbox"],
  //       ["slms-static-drag-n-drop"],
  //     ],
  //     handlers: {
  //       "slms-movable-drag-n-drop-textbox": () => this.insertMovableDragNDropTextbox(),
  //       "slms-static-drag-n-drop": () => this.insertStaticDragNDrop(),
  //     },
  //   },
  //   "better-table": {
  //     operationMenu: {
  //       items: {
  //         unmergeCells: {
  //           text: "Unmerge Cells",
  //         },
  //       },
  //       color: {
  //         colors: ["red", "green", "yellow", "blue", "white"],
  //         text: "Background Colors",
  //       },
  //     },
  //   },
  //   keyboard: {
  //     bindings: QuillBetterTable.keyboardBindings,
  //   },
  // };
  public elementId = ulid();
  public fillInHTML: string = "";
  // public textboxes: TextboxI[] = [];

  //--- Private
  private observer!: MutationObserver;
  @ViewChild("fillInInputContainer", { static: false }) private fillInInputContainer?: ElementRef<HTMLDivElement>;
  private _configuredBlanksSub: { unsubscribe(): void } | null = null;

  /** fill-in-input: modal when clicking a blank (keyed by blank id). */
  public blankConfigModalVisible = false;
  public selectedBlankId: string | null = null;
  /** Reactive form for modal so saved value is read synchronously on Save (avoids ngModel timing). */
  public blankConfigFormGroup = new FormGroup({
    correctAnswer: new FormControl<string>(""),
    caseSensitive: new FormControl<boolean>(false),
    points: new FormControl<number>(1),
  });

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.fillInHTML = this.itemFormGroup.value.fillIn;

    // Normalise originalAnswer for fill-in-input into an array of strings
    if (this.itemFormGroup.value.type === "fill-in-input") {
      const answers = this.getOriginalAnswersArray();
      this.itemFormGroup.get("originalAnswer").setValue(answers);
    }
  }

  /**
   * @name          ngOnDestroy
   * @description   Called when component is destroyed
   * @returns       {void}
   */
  public ngOnDestroy(): void {
    this._configuredBlanksSub?.unsubscribe();
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  /**
   * @name          ngAfterViewInit
   * @description   Called after the view has been initialized
   * @returns       {void}
   */
  public ngAfterViewInit(): void {
    this.textChangeObserver();
    this.transformBlanksToInputsForStudent();
    this.setupConfiguredBlankIndicators();
  }

  /** fill-in-input (editing): mark blanks that have correct answers so the teacher sees which are configured. */
  private setupConfiguredBlankIndicators(): void {
    if (this.itemFormGroup.value.type !== "fill-in-input") return;
    const run = (delay = 0) => setTimeout(() => this.applyConfiguredBlankIndicators(), delay);
    run(50); // once after editor has rendered
    this._configuredBlanksSub = this.itemFormGroup.get("fillInputBlanks")?.valueChanges?.subscribe?.(() => run()) ?? null;
  }

  private applyConfiguredBlankIndicators(): void {
    if (this.itemFormGroup.value.type !== "fill-in-input") return;
    const editorId = this.itemFormGroup.value.id;
    if (!editorId) return;
    const editorEl = document.getElementById(editorId);
    if (!editorEl) return;
    const configuredIds = new Set(
      this.getFillInputBlanks()
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

  public textChangeObserver(): void {
    const targetNode = document.getElementById(this.elementId) as HTMLElement;

    if (targetNode) {
      this.observer = new MutationObserver((mutations) => {
        // console.log("Mutation detected:", mutations);
        const html = targetNode.innerHTML;
        console.log("Updated HTML content:", html);
        this.itemFormGroup.get("fillIn").setValue(html);
        // You can emit changes or trigger saves here

        const temp = document.createElement("div");
        temp.innerHTML = html;
        const customTags = Array.from(temp.querySelectorAll("*")).filter(
          (el) => el.tagName.includes("-") // typical for Angular custom elements
        );

        // this.textboxes = []; // Reset textboxes array

        // temp.querySelectorAll("*").forEach((el) => {
        //   if (el.tagName.includes("-")) {
        //     // el.setAttribute("contenteditable", "false");
        //     console.log("Custom tag found:", el);
        //     this.textboxes.push({
        //       text: el.getAttribute("text") || null,
        //       participantAnswerId: el.getAttribute("participantAnswerId") || null,
        //       tagName: el.tagName.toLocaleLowerCase(),
        //       id: el.id || null,
        //       styles: el.getAttribute("style") || null,
        //       points: el.getAttribute("points") || null,
        //     });
        //   }
        // });

        // console.log("Custom Tags:", customTags.length, temp.querySelectorAll("*"));
      });

      this.observer.observe(targetNode, {
        childList: true, // new/remove nodes
        subtree: true, // deep changes
        characterData: true, // text content
        attributes: true, // style/class changes
        attributeFilter: ["class", "style"], // optional: limit attribute types
      });
    }
  }

  /**
   * In student-answering mode for fill-in-input, replace visual blanks with real input fields and
   * keep participantAnswer as an array aligned by blank index.
   */
  private transformBlanksToInputsForStudent(): void {
    const mode = this.formGroup?.value?.stateSettings?.mode;
    const action = this.formGroup?.value?.stateSettings?.action;
    if (mode !== "viewing" || action !== "student-answering" || this.itemFormGroup.value.type !== "fill-in-input") {
      return;
    }

    const container = this.fillInInputContainer?.nativeElement;
    if (!container) {
      return;
    }

    const spans = Array.from(container.querySelectorAll("span.slms-fill-input-blank")) as HTMLSpanElement[];
    const currentAnswers: string[] = Array.isArray(this.itemFormGroup.value.participantAnswer) ? [...this.itemFormGroup.value.participantAnswer] : [];

    spans.forEach((span, index) => {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "px-2 py-1 rounded-md outline-none border border-primary";
      input.value = currentAnswers[index] ?? "";
      input.placeholder = "";

      input.addEventListener("input", (event: Event) => {
        const value = (event.target as HTMLInputElement).value;
        const answers = Array.isArray(this.itemFormGroup.value.participantAnswer) ? [...this.itemFormGroup.value.participantAnswer] : [];
        answers[index] = value;
        this.itemFormGroup.get("participantAnswer").setValue(answers);
      });

      span.replaceWith(input);
    });
  }

  /**
   * For student-viewing-results and teacher-reviewing: HTML with blanks replaced by participant answers.
   */
  public getViewFillInHTML(): string {
    return this.buildFilledHtmlForResults();
  }

  /**
   * For viewing results / teacher reviewing, build HTML where blanks are replaced with participant answers.
   */
  private buildFilledHtmlForResults(): string {
    const html: string = this.itemFormGroup.value.fillIn || "";
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

  /**
   * Returns originalAnswer as a string array (used for fill-in-input correct answers)
   */
  private getOriginalAnswersArray(): string[] {
    const raw = this.itemFormGroup.value.originalAnswer;
    if (Array.isArray(raw)) {
      return [...raw];
    }
    if (typeof raw === "string" && raw.trim().length > 0) {
      return [raw];
    }
    return [];
  }

  public addCorrectAnswer(): void {
    const answers = this.getOriginalAnswersArray();
    answers.push("");
    this.itemFormGroup.get("originalAnswer").setValue(answers);
  }

  public removeCorrectAnswer(index: number): void {
    const answers = this.getOriginalAnswersArray();
    answers.splice(index, 1);
    this.itemFormGroup.get("originalAnswer").setValue(answers);
    // Remove the corresponding blank from the passage HTML so indices stay in sync
    const html = this.itemFormGroup.value.fillIn ?? "";
    if (html) {
      const temp = document.createElement("div");
      temp.innerHTML = html;
      const blanks = temp.querySelectorAll("span.slms-fill-input-blank");
      if (blanks[index]) {
        blanks[index].remove();
        this.itemFormGroup.get("fillIn").setValue(temp.innerHTML);
      }
    }
  }

  public onCorrectAnswerChange(index: number, value: string): void {
    const answers = this.getOriginalAnswersArray();
    answers[index] = value;
    this.itemFormGroup.get("originalAnswer").setValue(answers);
  }

  /** Total points for this item (fill-in-input: sum per-blank points). */
  public getTotalPoints(): number {
    if (this.itemFormGroup.value.type === "fill-in-input") {
      return this.getFillInputBlanks().reduce((sum, b) => sum + (b.points ?? 0), 0);
    }
    return this.itemFormGroup.value.points ?? 0;
  }

  /** Whether the answer at the given blank index is wrong (for UI e.g. line-through). */
  public isBlankAnswerWrong(index: number): boolean {
    if (this.itemFormGroup.value.type !== "fill-in-input") return false;
    const participantAnswers = this.itemFormGroup.value.participantAnswer;
    if (!Array.isArray(participantAnswers) || participantAnswers[index] == null) return false;
    const studentAnswer = String(participantAnswers[index] ?? "").trim();
    const blanks = this.getFillInputBlanks();
    const blank = blanks[index];
    if (!blank?.correctAnswers?.length) return false;
    const caseSensitive = !!blank.caseSensitive;
    const accepted = blank.correctAnswers.map((a) => (caseSensitive ? a : a.toLowerCase()));
    const normalized = caseSensitive ? studentAnswer : studentAnswer.toLowerCase();
    return !accepted.includes(normalized);
  }

  /** Correct answer(s) for the blank at the given index (for display in results). */
  public getCorrectAnswerForBlank(index: number): string {
    if (this.itemFormGroup.value.type !== "fill-in-input") return "";
    const blanks = this.getFillInputBlanks();
    const blank = blanks[index];
    const list = blank?.correctAnswers ?? [];
    return list.length ? list.join(", ") : "";
  }

  /** fill-in-input: get fillInputBlanks array from form. */
  private getFillInputBlanks(): { id: string; participantAnswer: string; correctAnswers: string[]; caseSensitive: boolean; points: number }[] {
    const v = this.itemFormGroup.get("fillInputBlanks")?.value;
    return Array.isArray(v) ? v : [];
  }

  /** fill-in-input: when clicking inside the editor, if target is a blank span, open config modal by id. */
  public onEditorAreaClick(ev: Event): void {
    if (this.itemFormGroup.value.type !== "fill-in-input") return;
    const target = ev.target as HTMLElement;
    const blank = target.closest?.("span.slms-fill-input-blank") as HTMLElement | null;
    if (!blank) return;
    ev.preventDefault();
    ev.stopPropagation();
    const blankId = blank.getAttribute("data-blank-id");
    if (!blankId) return;
    this.openBlankConfigModal(blankId);
  }

  /** fill-in-input: open modal for the blank with this id; create entry if missing. */
  public openBlankConfigModal(blankId: string): void {
    let blanks = this.getFillInputBlanks();
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
      this.itemFormGroup.get("fillInputBlanks").setValue(blanks);
    }
    this.selectedBlankId = blankId;
    this.blankConfigFormGroup.patchValue({
      correctAnswer: (entry.correctAnswers ?? []).join(", "),
      caseSensitive: entry.caseSensitive ?? false,
      points: entry.points ?? 1,
    });
    this.blankConfigModalVisible = true;
  }

  public closeBlankConfigModal(): void {
    this.blankConfigModalVisible = false;
    this.selectedBlankId = null;
  }

  /** fill-in-input: save modal values to the fillInputBlanks entry with selectedBlankId. */
  public saveBlankConfig(): void {
    if (this.selectedBlankId == null) return;
    const blanks = this.getFillInputBlanks();
    const v = this.blankConfigFormGroup.value;
    const correctAnswers = (v.correctAnswer ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const idx = blanks.findIndex((b) => b.id === this.selectedBlankId);
    if (idx === -1) return;
    blanks[idx] = {
      ...blanks[idx],
      correctAnswers,
      caseSensitive: v.caseSensitive ?? false,
      points: v.points ?? 1,
    };
    this.itemFormGroup.get("fillInputBlanks").setValue([...blanks]);
    this.closeBlankConfigModal();
  }

  /**
   * @name          insertMovableTextbox
   * @description   Inserts a movable textbox into the editor
   * @returns       {void}
   */
  public insertMovableTextbox(): void {
    const html = `<slms-movable-textbox view-mode="editing" points="55" item-number="" participant-answer=""></slms-movable-textbox>`;

    const editor = document.getElementById(this.elementId);
    editor.focus();

    const range = document.createRange();
    range.setStart(editor, 0);
    range.collapse(true);
    // Get the current Selection and apply the range
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const nodeToInsert = temp.firstElementChild;

    if (nodeToInsert) {
      range.insertNode(nodeToInsert);

      // Optional: insert a space after so user can continue typing
      const space = document.createTextNode("\u00A0"); // non-breaking space
      range.setStartAfter(nodeToInsert);
      range.insertNode(space);
    }

    // document.execCommand("insertHTML", false, html);
  }

  /**
   * @name          insertStaticTextbox
   * @description   Inserts a static textbox into the editor
   * @returns       {void}
   */
  public insertStaticTextbox(): void {
    const editor = document.getElementById(this.elementId);
    editor.focus();
    const html = `<slms-static-textbox view-mode="editing" points="123" item-number="" participant-answer=""></slms-static-textbox>`;
    document.execCommand("insertHTML", false, html);
  }

  /**
   * @name          insertStaticTextbox
   * @description   Inserts a static textbox into the editor
   * @returns       {void}
   */
  public insertImage(): void {
    const html = `<img src="https://upev-superlms.s3.ap-southeast-1.amazonaws.com/dev/uploaded/image-box-placeholder.jpg" alt="Image details" width="100%">`;
    document.execCommand("insertHTML", false, html);
  }

  insertTable() {
    // const editor = this.quill; // however you're getting your Quill instance
    // const tableModule: any = editor.getModule("better-table");
    // tableModule.insertTable(3, 3); // Example: Insert 3x3 table
  }

  /**
   * @name          onEditorCreated
   * @description   Callback when the Quill editor is created
   * @param        {EditorInitEvent} quillInstance
   * @returns       {void}
   */
  // public onEditorCreated(quillInstance: EditorInitEvent): void {
  //   this.quill = quillInstance.editor;

  //   const movableDragNDropTextbox = document.querySelector(".ql-slms-movable-drag-n-drop-textbox") as HTMLElement;
  //   if (movableDragNDropTextbox) {
  //     movableDragNDropTextbox.innerHTML = `<span class="ph-bold ph-arrows-out-cardinal"></span>`;
  //   }

  //   const staticDragNDropTextbox = document.querySelector(".ql-slms-static-drag-n-drop") as HTMLElement;
  //   console.log("staticDragNDropTextbox", staticDragNDropTextbox);

  //   if (staticDragNDropTextbox) {
  //     staticDragNDropTextbox.innerHTML = `<span class="ph-bold ph-rectangle-dashed"></span>`;
  //   }
  // }

  /**
   * @name          insertMovableDragNDropTextbox
   * @description   Inserts a movable drag and drop textbox into the editor
   * @returns       {void}
   */
  // public insertMovableDragNDropTextbox(): void {
  //   const range = this.quill.getSelection(true);
  //   this.quill.insertEmbed(0, "slms-movable-drag-n-drop-textbox", { text: "2", participantAnswerId: "" }, Quill.sources.USER);
  //   this.quill.setSelection(0, Quill.sources.SILENT);
  // }

  /**
   * @name          insertStaticDragNDrop
   * @description   Inserts a static drag and drop into the editor
   * @returns       {void}
   */
  // public insertStaticDragNDrop(): void {
  //   const range = this.quill.getSelection(true);
  //   this.quill.insertEmbed(range.index, "slms-static-drag-n-drop", { text: "2", participantAnswerId: "" }, Quill.sources.USER);
  //   this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
  // }

  /**
   * @name          updatePoints
   * @description   Updates the points of a textbox
   * @returns       {void}
   */
  public updatePoints(points: number, textbox: TextboxI): void {
    document.getElementById(textbox.id)?.setAttribute("points", points.toString());
  }

  /**
   * @name          fillInFormControl
   * @description   Gets the FormControl for the fill-in field
   * @returns       {FormControl}
   */
  public get fillInFormControl(): FormControl {
    return this.itemFormGroup.get("fillIn") as FormControl;
  }
}
