import { DatePipe, JsonPipe, NgClass, NgFor, NgIf, SlicePipe } from "@angular/common";
import { Component, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { AbstractControl, FormArray, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { TasksService, TasksSubjectService, TemplatesTagService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { SubSink } from "subsink";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { ManageTaskModalComponent } from "../manage-task-modal/manage-task-modal.component";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { CategoryFormGroup, ChoiceFormGroup, QuestionFormGroup, SetTaskFormGroup, TaskFormGroup } from "@isms-core/form-group";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NgxTinymceModule } from "ngx-tinymce";
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzBadgeModule } from "ng-zorro-antd/badge";
import { ActivatedRoute } from "@angular/router";
import { Task } from "@isms-core/interfaces";
import { SYSTEM_ID } from "@isms-core/utils";
import { Alphabet, Animations } from "@isms-core/constants";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { ContenteditableValueAccessorModule } from "@tinkoff/angular-contenteditable-accessor";

@Component({
  selector: "isms-task-builder",
  templateUrl: "./task-builder.component.html",
  imports: [
    NgIf,
    NgFor,
    NgClass,
    FormsModule,
    ReactiveFormsModule,
    JsonPipe,
    DatePipe,
    SlicePipe,
    NzTagModule,
    NzInputModule,
    NzDropDownModule,
    NzButtonModule,
    NzIconModule,
    NzInputNumberModule,
    NzCheckboxModule,
    NzTagModule,
    NzPopconfirmModule,
    NzBadgeModule,
    NzCollapseModule,
    NzSelectModule,
    NzSwitchModule,
    NzToolTipModule,
    NzEmptyModule,
    NgxTinymceModule,
    ContenteditableValueAccessorModule,
    SegmentedSelectorComponent,
    ManageTaskModalComponent,
  ],
  styles: [
    `
      .no-styles {
        font-family: sans-serif;
        font-weight: unset;
        > b {
          font-weight: 600;
          font-family: inherit;
        }
      }
    `,
  ],
  encapsulation: ViewEncapsulation.None,
})
export class TaskBuilderComponent implements OnInit, OnDestroy {
  private subSink = new SubSink();
  public taskFormGroup: FormGroup = TaskFormGroup();
  private taskId: string = null;
  public readonly alphabet = Alphabet;
  public status: string = "unpublished";

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly tasksService: TasksService,
    private readonly tasksSubjectService: TasksSubjectService,
    private readonly nzNotificationService: NzNotificationService
  ) {
    this.taskId = this.activatedRoute.parent.snapshot.paramMap.get("taskId");
    this.subSink.add(
      this.taskFormGroup.valueChanges.pipe(debounceTime(1000), distinctUntilChanged()).subscribe((value) => {
        if (value.status === "published" && this.status === "published") {
          this.nzNotificationService.warning("Editing task", 'Task is published. Changes won"t be save.');
        } else {
          lastValueFrom(this.tasksService.updateBuilderById({ categories: value.categories }, this.taskId)).then(() => {
            this.tasksSubjectService.send({ type: "updated", data: value });
          });
        }
      })
    );
  }

  public ngOnInit(): void {
    this.loadData();
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  public async loadData(): Promise<void> {
    lastValueFrom(this.tasksService.fetchById(this.taskId)).then((res) => {
      if (res.success) {
        const task: Task = res.data;
        this.status = res.data.status;
        SetTaskFormGroup(this.taskFormGroup, task, true);
        // task.categories.forEach((category) => {
        //   const categoryFormGroup = CategoryFormGroup();
        //   categoryFormGroup.get("id").setValue(category.id);
        //   categoryFormGroup.get("title").setValue(category.title);

        //   const questionsFormArray = categoryFormGroup.get("questions") as FormArray;
        //   category.questions.forEach((question) => {
        //     const questionFormGroup = QuestionFormGroup();
        //     questionFormGroup.get("id").setValue(question.id);
        //     questionFormGroup.get("title").setValue(question.title);
        //     questionFormGroup.get("description").setValue(question.description);

        //     questionFormGroup.get("fillInScore").setValue(question.fillInScore);
        //     questionFormGroup.get("originalAnswer").setValue(question.originalAnswer);
        //     questionFormGroup.get("attendeeAnswer").setValue(question.attendeeAnswer);

        //     const choicesFormArray = questionFormGroup.get("choices") as FormArray;
        //     question.choices.forEach((choice) => {
        //       const choiceFormGroup = ChoiceFormGroup();
        //       choiceFormGroup.get("id").setValue(choice.id);
        //       choiceFormGroup.get("value").setValue(choice.value);
        //       choicesFormArray.push(choiceFormGroup);
        //     });
        //     questionsFormArray.push(questionFormGroup);
        //   });

        //   this.categoriesFormArray.push(categoryFormGroup);
        // });
      }
    });
  }

  public onAddCategory(): void {
    const formGroup = CategoryFormGroup();
    formGroup.get("id").setValue(SYSTEM_ID());
    formGroup.get("title").setValue(null);
    this.categoriesFormArray.push(formGroup);

    this.taskFormGroup
      .get("editing")
      .get("categoryIndex")
      .setValue(this.categoriesFormArray.length - 1);
  }

  public onRemoveCategory(index: number): void {
    this.categoriesFormArray.removeAt(index);
    // if (this.taskFormGroup.value.editing.categoryIndex === index) {
    this.onSelectCategory(0);
    // }
  }

  public onAddQuestion(): void {
    const formGroup = QuestionFormGroup();
    formGroup.get("id").setValue(SYSTEM_ID());
    formGroup.get("title").setValue(null);
    formGroup.get("description").setValue(null);
    formGroup.get("expand").setValue(true);
    this.questionsFormArray.push(formGroup);
  }

  public onAddChoice(questionIndex: number): void {
    const formGroup = ChoiceFormGroup();
    formGroup.get("id").setValue(SYSTEM_ID());
    formGroup.get("value").setValue(null);
    this.choiceFormArray(questionIndex).push(formGroup);
  }

  public onMoveCategory(shift: number, currentIndex: number): void {
    let newIndex: number = currentIndex + shift;
    if (newIndex === -1) {
      newIndex = this.categoriesFormArray.length - 1;
    } else if (newIndex == this.categoriesFormArray.length) {
      newIndex = 0;
    }
    const currentGroup = this.categoriesFormArray.at(currentIndex);
    this.categoriesFormArray.removeAt(currentIndex);
    this.categoriesFormArray.insert(newIndex, currentGroup);
  }

  public toFormGroup(formGroup: AbstractControl): FormGroup {
    return formGroup as FormGroup;
  }

  public onSelectCategory(index: number): void {
    this.taskFormGroup.get("editing").get("categoryIndex").setValue(index);
  }

  public get categoriesFormArray(): FormArray {
    return this.taskFormGroup.get("categories") as FormArray;
  }

  public get categoryFormGroup(): FormGroup {
    return this.categoriesFormArray.controls[this.taskFormGroup.value.editing.categoryIndex] as FormGroup;
  }

  public get questionsFormArray(): FormArray {
    return this.categoryFormGroup.get("questions") as FormArray;
  }

  public questionFormGroup(questionIndex: number): FormGroup {
    return this.questionsFormArray.controls[questionIndex] as FormGroup;
  }

  public choiceFormArray(questionIndex: number): FormArray {
    return this.questionFormGroup(questionIndex).get("choices") as FormArray;
  }

  public originalAnswer(compare: string, originalAnswer: string): boolean {
    return compare === originalAnswer;
  }
}
