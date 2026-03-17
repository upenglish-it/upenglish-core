/**
 * Builder Component
 *
 * @file          builder.component
 * @description   This page allows the teacher to create and edit tasks.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
//--- RxJS
import { debounceTime, Subscription, timer } from "rxjs";
//--- Angular CDK
import { CdkDragDrop, DragDropModule } from "@angular/cdk/drag-drop";
//--- Angular Split
import { AngularSplitModule } from "angular-split";
//--- NG Zorro
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzModalModule, NzModalService } from "ng-zorro-antd/modal";
//--- Prime NG
import { EditorInitEvent, EditorModule } from "primeng/editor";
//--- Form Groups
import { PartFormGroup } from "./form-group/test-variation-part.form-group";
import { VariationFormGroup } from "./form-group/test-variation.form-group";
import { BoxTickingRowFormGroup, ChoiceFormGroup, DragNDropFormGroup } from "./form-group/test-variation-part-item-form.form-group";
//--- Interfaces
import { TestI } from "./form-group/test.form-group";
import { VariationFormGroupI } from "./form-group/test-variation.form-group";
import { DragToFillBlankI, FillInputBlankI, ItemFormGroup, ItemType } from "./form-group/test-variation-part-item.form-group";
import { ulid } from "ulidx";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
import { AccountService } from "@superlms/services/account/account.service";
//--- Components
import { DataComponent } from "./data";
import { EditorComponent } from "./components/editor/editor.component";
import { VariationItemComponent } from "./components/variation-item/variation-item.component";
import { NzInputModule } from "ng-zorro-antd/input";
import { AudioSelectorComponent } from "./components/editor/components/audio-selector/audio-selector.component";
import { BuilderService } from "@superlms/services/builder/builder.service";
import { NgClass } from "@angular/common";

@Component({
  selector: "slms-builder",
  templateUrl: "./builder.component.html",
  imports: [
    //--- NG Modules
    NgClass,
    RouterLink,
    ReactiveFormsModule,
    //--- Angular CDK
    DragDropModule,
    //--- Angular Split
    AngularSplitModule,
    //--- Prime NG
    EditorModule,
    //--- NG Zorro
    NzModalModule,
    NzInputModule,
    NzSelectModule,
    NzButtonModule,
    NzDropDownModule,
    //--- Components
    EditorComponent,
    VariationItemComponent,
    AudioSelectorComponent,
  ],
})
export class BuilderComponent extends DataComponent implements OnInit, OnDestroy {
  //--- Injectables
  public readonly apiService: ApiService = inject(ApiService);
  public readonly builderService: BuilderService = inject(BuilderService);
  public readonly AccountService: AccountService = inject(AccountService);
  public readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  public readonly nzModalService: NzModalService = inject(NzModalService);

  //--- Public
  public firstLoad: boolean = true;
  public test: TestI | null = null;
  public backRedirectUrl: string | null = null;
  public savingState: "saving" | "saved" | null = null;
  // public type: "template" | "test" | null = null;
  // public mode: "viewing" | "editing" | null = null;
  // public action: "teacher-reviewing" | "student-answering" | null = null;
  // public readonly quillModules: any = {
  //   toolbar: {
  //     theme: "bubble",
  //     container: [
  //       ["bold", "italic", "underline", "strike"], // toggled buttons
  //       ["blockquote", "code-block"],
  //       ["image", "formula"],

  //       // [{ header: 1 }, { header: 2 }], // custom button values
  //       [{ list: "ordered" }, { list: "bullet" }, { list: "check" }],
  //       [{ script: "sub" }, { script: "super" }], // superscript/subscript
  //       [{ indent: "-1" }, { indent: "+1" }], // outdent/indent
  //       // [{ size: ["small", false, "large", "huge"] }], // custom dropdown
  //       [{ header: [1, 2, 3, 4, 5, 6, false] }],

  //       [{ color: [] }, { background: [] }], // dropdown with defaults from theme
  //       [{ font: [] }],
  //       [{ align: [] }],
  //       ["clean"], // remove formatting button
  //       ["slms-static-drag-n-drop"],
  //     ],
  //     handlers: {
  //       "slms-static-drag-n-drop": () => this.insertStaticDragNDrop(),
  //     },
  //   },
  // };
  public textContentFormControl: FormControl<string> = new FormControl<string>("");

  public durationCountdown: number = 0;
  private durationTimer$: Subscription;

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.backRedirectUrl = this.activatedRoute.parent.snapshot.queryParams["backRedirectUrl"];

    this.loadData();
  }

  /**
   * @name          ngOnDestroy
   * @description   Called when component is destroyed
   * @returns       {void}
   */
  public ngOnDestroy(): void {
    if (this.durationTimer$) {
      this.durationTimer$.unsubscribe();
    }
  }

  /**
   * @name          loadData
   * @description   Load the data for the component
   * @returns       {void}
   */
  public loadData(): void {
    // this.type = this.activatedRoute.parent.snapshot.queryParams["type"];
    // this.mode = this.activatedRoute.parent.snapshot.queryParams["mode"];
    // this.action = this.activatedRoute.parent.snapshot.queryParams["action"];

    this.testFormGroup.get("stateSettings").get("type").setValue(this.activatedRoute.parent.snapshot.queryParams["type"], { emitEvent: false });
    this.testFormGroup.get("stateSettings").get("mode").setValue(this.activatedRoute.parent.snapshot.queryParams["mode"], { emitEvent: false });
    this.testFormGroup.get("stateSettings").get("action").setValue(this.activatedRoute.parent.snapshot.queryParams["action"], { emitEvent: false });

    const stateSettings = {
      ...this.testFormGroup.get("stateSettings"),
    };

    this.apiService.endPointsC.prompts.get.list(this.apiService).then((res) => {
      if (res) {
        this.builderService.setPrompts(res.data);
      }
    });

    this.apiService.endPointsC.tasks.get
      .getById(this.apiService, this.activatedRoute.parent.snapshot.paramMap?.get("taskId"), {
        mode: stateSettings.value.mode,
        action: stateSettings.value.action || "builder-editing",
        type: this.activatedRoute.parent.snapshot.queryParamMap?.get("type"),
      })
      .then((res) => {
        if (res) {
          this.test = res.data;
          this.setVariationsData();
        }
      });

    if (this.testFormGroup.value.stateSettings.mode === "editing" && this.testFormGroup.value.stateSettings.type === "template") {
      this.testFormGroup.valueChanges.pipe(debounceTime(500)).subscribe((value) => {
        console.log("Item Form Group Value Changes:", value);
        if (!this.firstLoad) {
          this.savingState = "saving";
          this.apiService.endPointsC.tasks.patch
            .updateById(this.apiService, this.activatedRoute.parent.snapshot.paramMap?.get("taskId"), this.buildPayloadForTaskUpdate(this.testFormGroup.value), {
              mode: stateSettings.value.mode,
              action: stateSettings.value.action || "builder-editing",
              type: this.activatedRoute.parent.snapshot.queryParamMap?.get("type"),
            })
            .then((res) => {
              if (res) {
                console.log("Task updated successfully:", res);
              }
            })
            .finally(() => {
              setTimeout(() => {
                this.savingState = "saved";
              }, 2000);
              setTimeout(() => {
                this.savingState = null;
              }, 4000);
            });
        }
      });

      this.testFormGroup
        .get("selectedVariationIndex")
        .valueChanges.pipe(debounceTime(500))
        .subscribe(() => {
          this.testFormGroup.get("selectedPartIndex").setValue(0, { emitEvent: false });
        });

      this.listenToContentFormControlChanges();
    }

    if (this.testFormGroup.value.stateSettings.mode === "editing" && this.testFormGroup.value.stateSettings.type === "test") {
      this.testFormGroup.valueChanges.pipe(debounceTime(500)).subscribe((value) => {
        console.log("Item Form Group Value Changes:", value);
        if (!this.firstLoad) {
          this.savingState = "saving";
          this.apiService.endPointsC.tasks.patch
            .updateById(this.apiService, this.activatedRoute.parent.snapshot.paramMap?.get("taskId"), this.buildPayloadForTaskUpdate(this.testFormGroup.value), {
              mode: stateSettings.value.mode,
              action: stateSettings.value.action || "builder-editing",
              type: this.activatedRoute.parent.snapshot.queryParamMap?.get("type"),
            })
            .then((res) => {
              if (res) {
                console.log("Task updated successfully:", res);
              }
            })
            .finally(() => {
              setTimeout(() => {
                this.savingState = "saved";
              }, 2000);
              setTimeout(() => {
                this.savingState = null;
              }, 4000);
            });
        }
      });
      this.listenToContentFormControlChanges();
    }

    if (
      this.testFormGroup.value.stateSettings.mode === "viewing" &&
      (this.testFormGroup.value.stateSettings.action === "student-answering" || this.testFormGroup.value.stateSettings.action === "teacher-reviewing")
    ) {
      this.testFormGroup.valueChanges.pipe(debounceTime(500)).subscribe((value) => {
        if (!this.firstLoad) {
          this.apiService.endPointsC.tasks.patch
            .updateById(this.apiService, this.activatedRoute.parent.snapshot.paramMap?.get("taskId"), this.buildPayloadForTaskUpdate(this.testFormGroup.value), {
              mode: stateSettings.value.mode,
              action: stateSettings.value.action || "builder-editing",
              type: this.activatedRoute.parent.snapshot.queryParamMap?.get("type"),
            })
            .then();
        }
      });

      //--- Listen to content changes only if the action is student-answering
      if (this.testFormGroup.value.stateSettings.action === "student-answering") {
        this.listenToContentFormControlChanges();
      }
    }

    this.firstLoad = false;
  }

  public listenToContentFormControlChanges(): void {
    this.textContentFormControl.valueChanges.pipe(debounceTime(500)).subscribe((value) => {
      if (!this.firstLoad) {
        this.partFormGroup.get("description").setValue(value.replace(/<slms-answer-box\b([^>]*)>(.*?)<\/slms-answer-box>/gis, "<slms-answer-box$1></slms-answer-box>"));
      }
    });
  }

  /**
   * @name          setVariationsData
   * @description   Set variations data
   * @returns       {void}
   */
  public setVariationsData(): void {
    this.testFormGroup.get("name").setValue(this.test.name);
    this.testFormGroup.get("duration").setValue(this.test.duration);
    this.testFormGroup.get("type").setValue(this.test.type);
    this.testFormGroup.get("mode").setValue(this.testFormGroup.value.stateSettings.mode);
    this.testFormGroup.get("submittedDate").setValue(this.test.submittedDate);

    // this.testFormGroup.get("selectedVariationIndex").setValue(this.test.selectedVariationIndex);
    // this.testFormGroup.get("selectedPartIndex").setValue(this.test.selectedPartIndex);

    this.testFormGroup.get("selectedVariationIndex").setValue(0);
    this.testFormGroup.get("selectedPartIndex").setValue(0);

    //--- Build Variations
    this.test.variations.forEach((variation: VariationFormGroupI) => {
      const variationFormGroup = VariationFormGroup();
      variationFormGroup.get("id").setValue(variation.id);
      variationFormGroup.get("reviewerAnswer").setValue(variation?.reviewerAnswer || "");
      variationFormGroup.get("audioRemarks").setValue(variation?.audioRemarks || "");
      //--- Build Parts
      const partsFormArray = variationFormGroup.get("parts") as FormArray;
      variation.parts.forEach((part) => {
        const partFormGroup = PartFormGroup();
        partFormGroup.get("id").setValue(part.id);
        partFormGroup.get("description").setValue(part.description);
        partFormGroup.get("showLeftPanel").setValue(part.showLeftPanel);

        let description =
          this.testFormGroup.value.mode === "editing"
            ? part.description
                .replace(/<slms-answer-box\b([^>]*)>(.*?)<\/slms-answer-box>/gis, "<slms-answer-box$1></slms-answer-box>")
                .replace(/view-mode="viewing"/g, 'view-mode="editing"')
            : part.description
                .replace(/<slms-answer-box\b([^>]*)>(.*?)<\/slms-answer-box>/gis, "<slms-answer-box$1></slms-answer-box>")
                .replace(/view-mode="editing"/g, 'view-mode="viewing"');

        console.log("description>>>>>>>> 1 ", description);

        const stripped = description.replace(/<[^>]*>/g, "").trim();
        description = stripped.length === 0 ? "" : description;

        partFormGroup.get("description").setValue(description);

        console.log("description>>>>>>>> 2", description);
        this.textContentFormControl.setValue(description, { emitEvent: false });

        //--- Build Items
        const itemsFormArray = partFormGroup.get("items") as FormArray;
        part.items.forEach((item) => {
          const itemFormGroup = ItemFormGroup();
          itemFormGroup.get("id").setValue(item.id);
          itemFormGroup.get("title").setValue(item.title);
          itemFormGroup.get("description").setValue(item.description);
          itemFormGroup.get("type").setValue(item.type);
          itemFormGroup.get("points").setValue(item.points);
          itemFormGroup.get("score").setValue(item.score || 0);
          itemFormGroup.get("reviewed").setValue(item.reviewed);
          itemFormGroup.get("originalAnswer").setValue(item.originalAnswer);
          itemFormGroup.get("participantAnswer").setValue(item.participantAnswer);
          itemFormGroup.get("reviewerAnswer").setValue(item.reviewerAnswer || "");
          itemFormGroup.get("wordCount").setValue(item.wordCount);
          itemFormGroup.get("itemNumber").setValue(item.itemNumber);

          if (item.type === "choice") {
            itemFormGroup.addControl("choices", new FormArray([]));
            const choicesFormArray = itemFormGroup.get("choices") as FormArray;
            const choices = item.choices?.length
              ? item.choices
              : [
                  { id: ulid(), text: "A" },
                  { id: ulid(), text: "B" },
                  { id: ulid(), text: "C" },
                  { id: ulid(), text: "D" },
                ];
            choices.forEach((choice: { id: string; text: string }) => {
              choicesFormArray.push(
                new FormGroup({
                  id: new FormControl(choice.id),
                  text: new FormControl(choice.text),
                })
              );
            });
          }

          if (item.type === "box-ticking") {
            this.populateBoxTickingItem(itemFormGroup, item);
          }

          // if (item.type === "box-ticking") {
          //   const rowsArray = itemFormGroup.get("boxTickingRows") as FormArray;
          //   console.log("rowsArray1:", rowsArray);
          //   rowsArray.clear();
          //   console.log("rowsArray1 cleared:", rowsArray);
          //   const backend = item as any;
          //   console.log("BACKEND", {
          //     backend,
          //     boxTickingOptions: backend.boxTickingOptions,
          //     boxTickingSelection: backend.boxTickingMaxSelection,
          //   });

          //   if (backend.boxTickingOptions?.length && backend.boxTickingMaxSelection != null) {
          //     const correctOptionIds = backend.boxTickingOptions.filter((o: { correctAnswer: boolean }) => o.correctAnswer).map((o: { id: string }) => o.id);
          //     const questionStr = backend.boxTickingQuestion ?? "";
          //     const rowQuestions = questionStr.split(/\n/);
          //     const answers: (string | null)[] = backend.boxTickingAnswers ?? [];

          //     console.log("DATAS", {
          //       correctOptionIds,
          //       questionStr,
          //       rowQuestions,
          //       answers,
          //     });
          //     for (let i = 0; i < backend.boxTickingMaxSelection; i++) {
          //       rowsArray.push(
          //         new FormGroup({
          //           question: new FormControl(rowQuestions[i]?.trim() ?? ""),
          //           originalAnswer: new FormControl(correctOptionIds[i] ?? null),
          //           participantAnswer: new FormControl(answers[i] ?? null),
          //         })
          //       );
          //     }
          //     const choicesFormArray = itemFormGroup.get("choices") as FormArray;
          //     choicesFormArray.clear();
          //     backend.boxTickingOptions.forEach((o: { id: string; value: string }) => {
          //       console.log("LASTS", {
          //         o,
          //       });
          //       choicesFormArray.push(new FormGroup({ id: new FormControl(o.id), text: new FormControl(o.value) }));
          //     });
          //   } else {
          //     const rows = backend.boxTickingRows;

          //     console.log("ELSE BLOCK:", {
          //       rows,
          //       item,
          //     });

          //     if (rows?.length) {
          //       rows.forEach((row: { question: string; originalAnswer: string | null; participantAnswer: string | null }) => {
          //         rowsArray.push(
          //           new FormGroup({
          //             question: new FormControl(row.question ?? ""),
          //             originalAnswer: new FormControl(row.originalAnswer ?? null),
          //             participantAnswer: new FormControl(row.participantAnswer ?? null),
          //           })
          //         );
          //       });
          //     } else {
          //       rowsArray.push(
          //         new FormGroup({
          //           question: new FormControl(item.title ?? ""),
          //           originalAnswer: new FormControl(item.originalAnswer ?? null),
          //           participantAnswer: new FormControl(item.participantAnswer ?? null),
          //         })
          //       );
          //     }
          //   }
          // }

          if (item.type === "fill-in") {
            const fillIn =
              this.testFormGroup.value.mode === "editing"
                ? item.fillIn
                    .replace(/<slms-answer-box\b([^>]*)>(.*?)<\/slms-answer-box>/gis, "<slms-answer-box$1></slms-answer-box>")
                    .replace(/view-mode="viewing"/g, 'view-mode="editing"')
                : item.fillIn
                    .replace(/<slms-answer-box\b([^>]*)>(.*?)<\/slms-answer-box>/gis, "<slms-answer-box$1></slms-answer-box>")
                    .replace(/view-mode="editing"/g, 'view-mode="viewing"');
            itemFormGroup.get("fillIn").setValue(fillIn);
          }

          if (item.type === "drag-drop") {
            const dragNDropFormArray = itemFormGroup.get("dragDrop") as FormArray;
            item.dragDrop.forEach((dragDropItem) => {
              dragNDropFormArray.push(
                new FormGroup({
                  id: new FormControl(dragDropItem.id),
                  itemNumber: new FormControl(dragDropItem.itemNumber),
                  value: new FormControl(dragDropItem.value),

                  participantAnswer: new FormControl(dragDropItem.participantAnswer || null),
                  reviewerAnswer: new FormControl(dragDropItem.reviewerAnswer || null),
                  points: new FormControl(dragDropItem.points || 0),
                  score: new FormControl(dragDropItem.score || 0),
                })
              );
            });
          }

          if (item.type === "fill-in-radio") {
            // itemFormGroup.get("boxTicking").setValue(item.boxTicking);

            const fillIn =
              this.testFormGroup.value.mode === "editing"
                ? item.fillIn
                    .replace(/<slms-table-box\b([^>]*)>(.*?)<\/slms-table-box>/gis, "<slms-table-box$1></slms-table-box>")
                    .replace(/view-mode="viewing"/g, 'view-mode="editing"')
                : item.fillIn
                    .replace(/<slms-table-box\b([^>]*)>(.*?)<\/slms-table-box>/gis, "<slms-table-box$1></slms-table-box>")
                    .replace(/view-mode="editing"/g, 'view-mode="viewing"');
            itemFormGroup.get("fillIn").setValue(fillIn);
          }

          if (item.type === "fill-in-input") {
            const sourceHtml = (item as any).fillInputContent ?? item.fillIn ?? "";
            itemFormGroup.get("fillIn").setValue(sourceHtml);

            const backendBlanks = (item as any).fillInputBlanks as
              | { id?: string; participantAnswer?: string; correctAnswers?: string[]; caseSensitive?: boolean; points?: number }[]
              | undefined;
            if (backendBlanks?.length) {
              itemFormGroup.get("fillInputCaseSensitive").setValue(!!backendBlanks[0].caseSensitive);
              const original = backendBlanks.map((b) => (b.correctAnswers ?? []).join(", "));
              itemFormGroup.get("originalAnswer").setValue(original);
              const blanks: FillInputBlankI[] = backendBlanks.map((b) => ({
                id: b.id ?? ulid(),
                participantAnswer: b.participantAnswer ?? "",
                correctAnswers: b.correctAnswers ?? [],
                caseSensitive: !!b.caseSensitive,
                points: b.points ?? 1,
              }));
              itemFormGroup.get("fillInputBlanks").setValue(blanks);
            }
          }

          if (item.type === "drag-to-fill") {
            const sourceHtml = (item as any).dragToFillContent ?? (item as any).fillInputContent ?? item.fillIn ?? "";
            itemFormGroup.get("dragToFillContent").setValue(sourceHtml);

            const backendBlanks = (item as any).dragToFillBlanks as
              | { id?: string; participantAnswer?: string; correctAnswers?: string[]; caseSensitive?: boolean; points?: number }[]
              | undefined;
            const fallbackBlanks = (item as any).fillInputBlanks as typeof backendBlanks;
            const blanksSource = backendBlanks?.length ? backendBlanks : fallbackBlanks;
            if (blanksSource?.length) {
              itemFormGroup.get("fillInputCaseSensitive").setValue(!!blanksSource[0].caseSensitive);
              const original = blanksSource.map((b) => (b.correctAnswers ?? []).join(", "));
              itemFormGroup.get("originalAnswer").setValue(original);
              const blanks: DragToFillBlankI[] = blanksSource.map((b) => ({
                id: b.id ?? ulid(),
                participantAnswer: b.participantAnswer ?? "",
                correctAnswers: b.correctAnswers ?? [],
                caseSensitive: !!b.caseSensitive,
                points: b.points ?? 1,
              }));
              itemFormGroup.get("dragToFillBlanks").setValue(blanks);
            }
          }
          // if (item.type === "speaking") {
          itemFormGroup.get("speaking").setValue(item.speaking);
          // }

          if (item.type === "ielts-writing") {
            itemFormGroup.get("ieltsWriting").setValue(item.ieltsWriting);
            if (item.ieltsWritingResult) {
              itemFormGroup.get("ieltsWritingResult").setValue(item.ieltsWritingResult);
            }

            itemFormGroup.get("aiPrompt").setValue(item.aiPrompt || null);
          }

          if (item.type === "ielts-speaking") {
            itemFormGroup.get("ieltsSpeaking").setValue(item.ieltsSpeaking);
            itemFormGroup.get("aiPrompt").setValue(item.aiPrompt || null);
          }

          itemsFormArray.push(itemFormGroup);
        });

        //--- Push the parts
        partsFormArray.push(partFormGroup);
      });

      //--- Push the variations
      this.variationsFormArray.push(variationFormGroup, { emitEvent: false });
    });

    if (this.testFormGroup.value.stateSettings.action === "student-answering") {
      this.durationTimer$ = timer(this.test.duration, 1000).subscribe((sec) => {
        this.durationCountdown = this.test.duration - sec;
        if (this.durationCountdown <= 0) {
          this.nzModalService.confirm({
            nzTitle: "Time's up!",
            nzContent: "Your time has expired.",
            nzClosable: false,
            nzCloseIcon: null,
            nzCentered: true,
            nzWidth: "500px",
            nzCancelText: null,
            nzOkText: "Back to class",
            nzOnOk: () => {
              location.href = this.backRedirectUrl || "/s/dashboard";
            },
          });
          this.studentSubmitTask(false);
        }
      });
    }
  }

  /**
   * @name          setPartsData
   * @description   Set parts data
   * @returns       {void}
   */
  public setPartsData(): void {
    // console.log("this.test", this.test);
    // this.test.variations.forEach((variation: VariationFormGroupI) => {
    //   const variationFormGroup = VariationFormGroup();
    //   variationFormGroup.get("showLeftPanel").setValue(variation.showLeftPanel);
    //   const description =
    //     this.testFormGroup.value.mode === "editing"
    //       ? variation.description
    //           .replace(/<slms-answer-box\b([^>]*)>(.*?)<\/slms-answer-box>/gis, "<slms-answer-box$1></slms-answer-box>")
    //           .replace(/view-mode="viewing"/g, 'view-mode="editing"')
    //       : variation.description
    //           .replace(/<slms-answer-box\b([^>]*)>(.*?)<\/slms-answer-box>/gis, "<slms-answer-box$1></slms-answer-box>")
    //           .replace(/view-mode="editing"/g, 'view-mode="viewing"');
    //   console.log("description", description, this.testFormGroup.value.mode);
    //   variationFormGroup.get("description").setValue(description);
    //   this.textContentFormControl.setValue(description);
    //   this.variationsFormArray.push(variationFormGroup);
    //   variation.items.forEach((item) => {
    //     const itemFormGroup = ItemFormGroup();
    //     itemFormGroup.get("id").setValue(item.id);
    //     itemFormGroup.get("title").setValue(item.title);
    //     itemFormGroup.get("description").setValue(item.description);
    //     itemFormGroup.get("type").setValue(item.type);
    //     itemFormGroup.get("points").setValue(item.points);
    //     itemFormGroup.get("originalAnswer").setValue(item.originalAnswer);
    //     itemFormGroup.get("itemNumber").setValue(item.itemNumber);
    //     if (item.type === "choice") {
    //       itemFormGroup.addControl("choices", new FormArray([]));
    //       console.log("itemFormGroup", itemFormGroup);
    //       const choicesFormArray = itemFormGroup.get("choices") as FormArray;
    //       item.choices.forEach((choice) => {
    //         choicesFormArray.push(new FormGroup({ id: new FormControl(choice.id), text: new FormControl(choice.text) }));
    //       });
    //     }
    //     if (item.type === "fill-in") {
    //       const fillIn =
    //         this.testFormGroup.value.mode === "editing"
    //           ? item.fillIn
    //               .replace(/<slms-answer-box\b([^>]*)>(.*?)<\/slms-answer-box>/gis, "<slms-answer-box$1></slms-answer-box>")
    //               .replace(/view-mode="viewing"/g, 'view-mode="editing"')
    //           : item.fillIn
    //               .replace(/<slms-answer-box\b([^>]*)>(.*?)<\/slms-answer-box>/gis, "<slms-answer-box$1></slms-answer-box>")
    //               .replace(/view-mode="editing"/g, 'view-mode="viewing"');
    //       itemFormGroup.get("fillIn").setValue(fillIn);
    //     }
    //     if (item.type === "drag-drop") {
    //       const dragNDropFormArray = itemFormGroup.get("dragDrop") as FormArray;
    //       item.dragDrop.forEach((dragDropItem) => {
    //         dragNDropFormArray.push(
    //           new FormGroup({
    //             id: new FormControl(dragDropItem.id),
    //             itemNumber: new FormControl(dragDropItem.itemNumber),
    //             value: new FormControl(dragDropItem.value),
    //           })
    //         );
    //       });
    //     }
    //     // if (item.type === "box-ticking") {
    //     //   itemFormGroup.get("boxTicking").setValue(item.boxTicking);
    //     // }
    //     // if (item.type === "speaking") {
    //     //   itemFormGroup.get("speaking").setValue(item.speaking);
    //     // }
    //     if (item.type === "ielts-writing") {
    //       itemFormGroup.get("ieltsWriting").setValue(item.ieltsWriting);
    //     }
    //     if (item.type === "ielts-speaking") {
    //       itemFormGroup.get("ieltsSpeaking").setValue(item.ieltsSpeaking);
    //     }
    //     this.itemsFormArray.push(itemFormGroup);
    //   });
    //   // console.log("variationFormGroup", variationFormGroup, this.variationsFormArray);
    // });
    // // console.log(">>>", JSON.stringify(this.testFormGroup.value, null, 2));
  }

  /**
   * @name          onEditorCreated
   * @description   Callback when the Quill editor is created
   * @param        {EditorInitEvent} quillInstance
   * @returns       {void}
   */
  public onEditorCreated(quillInstance: EditorInitEvent): void {
    console.log("a ", quillInstance);
    this.quill = quillInstance.editor;

    const customButton = document.querySelector(".ql-slms-static-drag-n-drop") as HTMLElement;
    if (customButton) {
      customButton.innerHTML = `<span class="ph-bold ph-textbox"></span>`;
    }

    // const editorContainer = this.quill.root;

    // editorContainer.addEventListener("drop", (event: DragEvent) => {
    //   event.preventDefault();
    //   const label = event.dataTransfer?.getData("text/plain") || "Dropped item";

    //   // Calculate drop position
    //   const dropPos = this.quill.getSelection()?.index ?? this.quill.getLength();
    //   this.quill.insertEmbed(dropPos, "draggable", { label }, "user");
    //   this.quill.setSelection(dropPos + 1);
    // });

    // editorContainer.addEventListener("dragover", (e: DragEvent) => {
    //   e.preventDefault(); // Needed to allow drop
    // });
  }

  // insertTextbox() {
  //   // if (!this.quill) return;

  //   //--- Insert draggable
  //   // const range = this.quill.getSelection(true);
  //   // this.quill.insertEmbed(0, "slms-textbox", { text: "2", participantAnswerId: "" }, Quill.sources.USER);
  //   // this.quill.setSelection(0, Quill.sources.SILENT);

  //   //--- Insert non-draggable
  //   const range = this.quill.getSelection(true);
  //   this.quill.insertEmbed(range.index, "slms-textbox", { text: "2", participantAnswerId: "" }, Quill.sources.USER);
  //   this.quill.setSelection(range.index + 1, Quill.sources.SILENT);

  //   // const range = this.quill.getSelection(true);
  //   // this.quill.insertEmbed(range.index, "slms-drag-n-drop", { label: "Drag Me" }, Quill.sources.USER);
  //   // this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
  // }

  // insertMovableBox() {
  //   // if (!this.quill) return;
  //   const range = this.quill.getSelection(true);
  //   // this.quill.insertEmbed(0, "slms-textbox", { text: "2", participantAnswerId: "" }, Quill.sources.USER);
  //   // this.quill.setSelection(0, Quill.sources.SILENT);

  //   this.quill.insertEmbed(0, "slms-movable-drag-n-drop", { text: "2", participantAnswerId: "" }, Quill.sources.USER);
  //   this.quill.setSelection(0, Quill.sources.SILENT);

  //   // const range = this.quill.getSelection(true);
  //   // this.quill.insertEmbed(range.index, "slms-drag-n-drop", { label: "Drag Me" }, Quill.sources.USER);
  //   // this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
  // }

  // /**
  //  * @name          insertStaticDragNDrop
  //  * @description   Inserts a static drag and drop item into the editor
  //  * @returns       {void}
  //  */
  // public insertStaticDragNDrop(): void {
  //   const range = this.quill.getSelection(true);
  //   this.quill.insertEmbed(range.index, "slms-static-drag-n-drop", { text: "2", participantAnswerId: "" }, Quill.sources.USER);
  //   this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
  // }

  // insertMovableBox() {
  //   // if (!this.quill) return;
  //   const range = this.quill.getSelection(true);
  //   // this.quill.insertEmbed(0, "slms-textbox", { text: "2", participantAnswerId: "" }, Quill.sources.USER);
  //   // this.quill.setSelection(0, Quill.sources.SILENT);

  //   this.quill.insertEmbed(0, "slms-movable-drag-n-drop", { text: "2", participantAnswerId: "" }, Quill.sources.USER);
  //   this.quill.setSelection(0, Quill.sources.SILENT);

  //   // const range = this.quill.getSelection(true);
  //   // this.quill.insertEmbed(range.index, "slms-drag-n-drop", { label: "Drag Me" }, Quill.sources.USER);
  //   // this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
  // }

  // /**
  //  * @name          loadItems
  //  * @description   load the created items
  //  * @returns       {void}
  //  */
  // public insertDraggable() {
  //   console.log(">>", this.quill);
  //   const range = this.quill.getSelection(true);
  //   this.quill.insertEmbed(range.index, "slms-drag-n-drop", { label: "Drag Me" }, Quill.sources.USER);
  //   this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
  // }

  /**
   * Builds payload for task PATCH with backend-aligned fields (box-ticking + fill-in-input).
   */
  private buildPayloadForTaskUpdate(value: any): any {
    const payload = JSON.parse(JSON.stringify(value));
    payload.variations?.forEach((variation: { parts?: { items?: any[] }[] }) => {
      variation.parts?.forEach((part: { items?: any[] }) => {
        part.items?.forEach((item: any) => {
          // if (item.type === "box-ticking" && Array.isArray(item.boxTickingRows) && Array.isArray(item.choices)) {
          //   item.boxTickingQuestion = item.boxTickingRows.map((r: { question: string }) => r.question ?? "").join("\n");
          //   item.boxTickingOptions = item.choices.map((c: { id: string; text: string }) => ({
          //     id: c.id,
          //     value: c.text,
          //     correctAnswer: item.boxTickingRows.some((r: { originalAnswer: string | null }) => r.originalAnswer === c.id),
          //     points: 1,
          //   }));
          //   item.boxTickingAnswers = item.boxTickingRows.map((r: { participantAnswer: string | null }) => r.participantAnswer ?? "");
          //   item.boxTickingMaxSelection = item.boxTickingRows.length;
          // }

          if (item.type === "box-ticking" && Array.isArray(item.boxTickingRows)) {
            // Keep rows as the source of truth
            item.rows = item.boxTickingRows.map((r: any) => ({
              question: r.question ?? "",
              originalAnswer: r.originalAnswer ?? null,
              participantAnswer: r.participantAnswer ?? null,
              points: r.points ?? 1,
            }));

            item.boxTickingRows = item.boxTickingRows.map((r: any) => ({
              question: r.question ?? "",
              originalAnswer: r.originalAnswer ?? null,
              participantAnswer: r.participantAnswer ?? null,
              points: r.points ?? 1,
            }));

            // Keep choices simple
            item.choices =
              item.choices?.map((c: any) => ({
                id: c.id,
                text: c.text,
              })) ?? [];

            // Clean up legacy / generated fields
            delete item.boxTickingOptions;
            delete item.boxTickingQuestion;
            delete item.boxTickingAnswers;
            delete item.boxTickingMaxSelection;
          }

          if (item.type === "fill-in-input") {
            const html: string = item.fillIn ?? "";
            item.fillInputContent = html;

            const temp = document.createElement("div");
            temp.innerHTML = html || "";
            const spanBlanks = Array.from(temp.querySelectorAll("span.slms-fill-input-blank")) as HTMLSpanElement[];
            const existingBlanks: FillInputBlankI[] = Array.isArray((item as any).fillInputBlanks) ? (item as any).fillInputBlanks : [];
            const participantAnswers: string[] = Array.isArray(item.participantAnswer) ? item.participantAnswer : [];

            item.fillInputBlanks = spanBlanks.map((span, index) => {
              const id = span.getAttribute("data-blank-id") || ulid();
              const existing = existingBlanks.find((b) => b.id === id);
              return {
                id,
                participantAnswer: participantAnswers[index] ?? existing?.participantAnswer ?? "",
                correctAnswers: existing?.correctAnswers ?? [],
                caseSensitive: existing?.caseSensitive ?? false,
                points: existing?.points ?? 1,
              };
            });
          }

          if (item.type === "drag-to-fill") {
            const html: string = item.dragToFillContent ?? "";
            item.dragToFillContent = html;

            const temp = document.createElement("div");
            temp.innerHTML = html || "";
            const spanBlanks = Array.from(temp.querySelectorAll("span.slms-fill-input-blank")) as HTMLSpanElement[];
            const existingBlanks: DragToFillBlankI[] = Array.isArray((item as any).dragToFillBlanks) ? (item as any).dragToFillBlanks : [];
            const participantAnswers: string[] = Array.isArray(item.participantAnswer) ? item.participantAnswer : [];

            item.dragToFillBlanks = spanBlanks.map((span, index) => {
              const id = span.getAttribute("data-blank-id") || ulid();
              const existing = existingBlanks.find((b) => b.id === id);
              return {
                id,
                participantAnswer: participantAnswers[index] ?? existing?.participantAnswer ?? "",
                correctAnswers: existing?.correctAnswers ?? [],
                caseSensitive: existing?.caseSensitive ?? false,
                points: existing?.points ?? 1,
              };
            });
          }
        });
      });
    });
    return payload;
  }

  /**
   * @name          addItem
   * @description   Adds a new item to the editor
   * @returns       {void}
   */
  public addItem(type: ItemType): void {
    const itemFormGroup = ItemFormGroup();

    itemFormGroup.get("type").setValue(type);

    console.log("Adding item of type:", type);

    if (type === "drag-drop") {
      const formArray = itemFormGroup.get("dragDrop") as FormArray;
      formArray.push(DragNDropFormGroup());
    }
    if (type === "choice") {
      const formArray = itemFormGroup.get("choices") as FormArray;
      formArray.push(ChoiceFormGroup());
    }

    if (type === "box-ticking") {
      // Ensure FormArray exists
      if (!itemFormGroup.get("choices")) {
        itemFormGroup.addControl("choices", new FormArray([]));
      }
      const choicesArray = itemFormGroup.get("choices") as FormArray;
      ["A", "B", "C", "D"].forEach((letter) => {
        const g = ChoiceFormGroup();
        g.get("text").setValue(letter);
        choicesArray.push(g);
      });

      if (!itemFormGroup.get("boxTickingRows")) {
        itemFormGroup.addControl("boxTickingRows", new FormArray([]));
      }
      const rowsArray = itemFormGroup.get("boxTickingRows") as FormArray;
      rowsArray.push(BoxTickingRowFormGroup());
    }

    this.itemsFormArray.push(itemFormGroup);
  }

  /**
   * @name          dropItem
   * @description   Reorders items when dropped in the list (drag and drop)
   * @returns       {void}
   */
  public dropItem(event: CdkDragDrop<FormGroup[]>): void {
    const items = this.itemsFormArray;
    const control = items.at(event.previousIndex);
    items.removeAt(event.previousIndex);
    items.insert(event.currentIndex, control);
  }

  /**
   * @name          addPart
   * @description   Adds a new part to the variation
   * @returns       {void}
   */
  public addVariation(): void {
    const variationFormGroup = VariationFormGroup();
    (variationFormGroup.get("parts") as FormArray).push(PartFormGroup());
    this.variationsFormArray.push(variationFormGroup);
  }

  /**
   * @name          deleteVariation
   * @description   Deletes the selected variation
   * @returns       {void}
   */
  public deleteVariation(): void {
    this.variationsFormArray.removeAt(this.testFormGroup.get("selectedVariationIndex").value);
    this.testFormGroup.get("selectedVariationIndex").setValue(0);
    this.testFormGroup.get("selectedPartIndex").setValue(0);
  }

  /**
   * @name          addPart
   * @description   Adds a new part to the variation
   * @returns       {void}
   */
  public addPart(): void {
    const partFormGroup = PartFormGroup();
    this.partsFormArray.push(partFormGroup);
  }

  /**
   * @name          studentSubmitTask
   * @description   Student submit the task
   * @returns       {void}
   */
  public studentSubmitTask(showModal: boolean): void {
    this.durationTimer$.unsubscribe();
    this.apiService.endPointsC.tasks.post
      .studentSubmitTask(this.apiService, { taskId: this.activatedRoute.parent.snapshot.paramMap?.get("taskId") })
      .then()
      .finally(() => {
        if (showModal) {
          this.nzModalService.success({
            nzTitle: "Task Submitted",
            nzContent: "Your task has been submitted successfully.",
            nzClosable: false,
            nzCloseIcon: null,
            nzCentered: true,
            nzCancelText: null,
            nzWidth: "500px",
            nzOnOk: () => {
              location.href = decodeURIComponent(this.backRedirectUrl) || "/s/dashboard";
            },
          });
        }
      });
  }

  /**
   * @name          teacherSubmitTask
   * @description   Teacher submit the task for review
   * @returns       {void}
   */
  public teacherSubmitTask(): void {
    this.apiService.endPointsC.tasks.post
      .teacherMarkTaskAsReviewed(this.apiService, { taskId: this.activatedRoute.parent.snapshot.paramMap?.get("taskId") })
      .then()
      .finally(() => {
        this.nzModalService.success({
          nzTitle: "Review Submitted",
          nzContent: "The task review has been submitted successfully.",
          nzCentered: true,
          nzClosable: false,
          nzCloseIcon: null,
          nzCancelText: null,
          nzWidth: "500px",
          nzOnOk: () => {
            location.href = decodeURIComponent(this.backRedirectUrl) || "/t/dashboard";
          },
        });
      });
  }

  /**
   * @name          variationsFormArray
   * @description   Get the variations form array
   * @returns       {FormArray}
   */
  public get variationsFormArray(): FormArray {
    return this.testFormGroup.get("variations") as FormArray;
  }

  /**
   * @name          variationFormGroup
   * @description   Get the variation form group
   * @returns       {FormGroup}
   */
  public get variationFormGroup(): FormGroup {
    return this.variationsFormArray.controls[this.testFormGroup.value.selectedVariationIndex] as FormGroup;
  }

  /**
   * @name          partsFormArray
   * @description   Get the parts form array
   * @returns       {FormGroup}
   */
  public get partsFormArray(): FormArray {
    return (this.variationFormGroup?.controls["parts"] as FormArray) || new FormArray([]);
  }

  /**
   * @name          partFormGroup
   * @description   Get the part form group
   * @returns       {FormGroup}
   */
  public get partFormGroup(): FormGroup {
    return this.partsFormArray.controls[this.testFormGroup.value.selectedPartIndex] as FormGroup;
  }

  /**
   * @name          hasPartDescription
   * @description   check if has part description
   * @returns       {boolean}
   */
  public get hasPartDescription(): boolean {
    const part = this.partFormGroup;
    if (!part) return false;
    const desc = part.get("description")?.value;
    if (desc == null || typeof desc !== "string") return false;
    const stripped = desc.replace(/<[^>]*>/g, "").trim();
    return stripped.length > 0;
  }

  // Show the left panel if the description has a value
  // if the action === editing
  // if the mode is builder-editing
  public get showPartDescriptionPanel(): boolean {
    return this.hasPartDescription || this.testFormGroup?.value?.mode === "editing" || this.testFormGroup?.value?.stateSettings?.action === "builder-editing";
  }

  /**
   * @name          itemsFormArray
   * @description   Get the items form array
   * @returns       {FormArray}
   */
  public get itemsFormArray(): FormArray {
    return (this.partFormGroup?.controls["items"] as FormArray) || new FormArray([]);
  }

  /**
   * @name          itemFormGroup
   * @description   Get the item form group
   * @returns       {FormGroup}
   */
  public itemFormGroup(itemIndex: number): FormGroup {
    return this.itemsFormArray.at(itemIndex) as FormGroup;
  }

  /** Populate a box-ticking item from backend data */
  public populateBoxTickingItem(itemFormGroup: FormGroup, backendItem: any): void {
    // --- Choices ---
    const choicesArray = itemFormGroup.get("choices") as FormArray;
    choicesArray.clear();
    (backendItem.choices ?? []).forEach((choice: { id: string; text: string }) => {
      choicesArray.push(
        new FormGroup({
          id: new FormControl(choice.id),
          text: new FormControl(choice.text),
        })
      );
    });

    // --- Rows ---
    const rowsArray = itemFormGroup.get("boxTickingRows") as FormArray;
    rowsArray.clear();
    (backendItem.boxTickingRows ?? []).forEach((row: any) => {
      rowsArray.push(
        new FormGroup({
          question: new FormControl(row.question ?? ""),
          originalAnswer: new FormControl(row.originalAnswer ?? null),
          participantAnswer: new FormControl(row.participantAnswer ?? null),
          // points: row.points ?? 1,
          // points: new FormControl(row.points ?? 1),
        })
      );
    });

    // --- Fallback: at least one row ---
    if (rowsArray.length === 0) {
      rowsArray.push(
        new FormGroup({
          question: new FormControl(""),
          originalAnswer: new FormControl(null),
          participantAnswer: new FormControl(null),
          // points: new FormControl(1),
        })
      );
    }
  }
}
