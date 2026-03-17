import { Component, Input, OnInit, ViewEncapsulation } from "@angular/core";
import { DatePipe, JsonPipe, NgClass, NgFor, NgIf } from "@angular/common";
import { Animations, ParticipantRTinyMCEConfig, ReviewerRTinyMCEConfig } from "@isms-core/constants";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NgxTinymceModule } from "ngx-tinymce";
import { AbstractControl, FormArray, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { TinyMCEIFrameFullHeightDirective } from "@isms-core/directives";
import { SetTaskFormGroup, TaskFormGroup } from "@isms-core/form-group";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { TasksSubmissionsService } from "@isms-core/services";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzSpinModule } from "ng-zorro-antd/spin";
import { SubSink } from "subsink";
import { NzDividerModule } from "ng-zorro-antd/divider";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { IAccount, TaskCategory, TaskQuestion } from "@isms-core/interfaces";
import { NzWaterMarkModule } from "ng-zorro-antd/water-mark";

@Component({
  selector: "isms-task-result",
  templateUrl: "./task-result.component.html",
  styleUrls: ["./task-result.component.scss"],
  encapsulation: ViewEncapsulation.None,
  animations: [Animations.down],
  imports: [
    NgIf,
    NgFor,
    NgClass,
    DatePipe,
    JsonPipe,
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzIconModule,
    NzTagModule,
    NzSpinModule,
    NzWaterMarkModule,
    NzDividerModule,
    NgxTinymceModule,
    TinyMCEIFrameFullHeightDirective,
  ],
})
export class TaskResultComponent implements OnInit {
  @Input({ alias: "submission-id", required: true }) public submissionId: string;
  @Input("view-type") public viewType: "plain" | "page" | "viewing-modal" | "reviewing-modal" = "page";
  @Input("from-page") public fromPage: "submissions-page" | "student-taking-task" = "submissions-page";
  @Input("start-reviewing-participant-answer") public startReviewingParticipantAnswer: boolean = false;
  private subSink = new SubSink();

  public account: IAccount | null = null;
  public readonly taskFormGroup: FormGroup = TaskFormGroup();
  public readonly participantRTinyMCEConfig = ParticipantRTinyMCEConfig;
  public readonly reviewerRTinyMCEConfig = {
    ...ReviewerRTinyMCEConfig,
    height: 200,
  };

  public reviewingParticipantAnswer: boolean = false;
  public loading: boolean = false;

  constructor(private readonly tasksSubmissionsService: TasksSubmissionsService) {}

  public ngOnInit(): void {
    /* wait after reviewing participant answer is done else just load the already reviewed answer */
    if (this.startReviewingParticipantAnswer) {
      this.reviewingParticipantAnswer = true;
      this.reviewParticipantAnswer();
    } else {
      this.loadData();
    }
  }

  public async loadData(): Promise<void> {
    this.loading = true;
    lastValueFrom(this.tasksSubmissionsService.fetchById(this.submissionId))
      .then((res) => {
        if (res.success) {
          console.log("ress", res);

          this.account = res.data.account;

          SetTaskFormGroup(
            this.taskFormGroup,
            {
              ...res.data.task,
              createdAt: res.data.createdAt,
            },
            false
          );
          this.taskFormGroup.get("editing").get("categoryIndex").setValue(0);
          this.taskFormGroup.get("editing").get("questionIndex").setValue(0);

          this.initializeFormGroup();
        }
      })
      .finally(() => {
        this.loading = false;
      });
  }

  private initializeFormGroup(): void {
    this.subSink.add(
      this.taskFormGroup.valueChanges.pipe(debounceTime(1000), distinctUntilChanged()).subscribe((value) => {
        console.log("initializeFormGroup", value);
      })
    );
  }

  public async reviewParticipantAnswer(): Promise<void> {
    lastValueFrom(this.tasksSubmissionsService.reviewParticipantAnswer(this.submissionId))
      .then((res) => {
        if (res.success) {
          this.loadData();
        }
      })
      .finally(() => {
        this.reviewingParticipantAnswer = false;
      });
  }

  public submitReview(question: TaskQuestion, categoryIndex: number): void {
    console.log("question", question, categoryIndex, 0);
    this.reviewingParticipantAnswer = true;

    lastValueFrom(
      this.tasksSubmissionsService.reviewParticipantAnswer(this.submissionId, {
        review: {
          categoryIndex: categoryIndex,
          questionIndex: 0,
          conclusion: question.reviewerAnswer,
          reviewerScore: question.reviewerScore,
        },
      })
    ).then((res) => {
      this.reviewingParticipantAnswer = false;
      if (res.success) {
        // this.questionFormGroup(categoryIndex).get("conclusion").setValue(question.reviewerAnswer);
        // this.questionFormGroup(categoryIndex).get("reviewerScore").setValue(question.reviewerScore);
        // this.questionFormGroup(categoryIndex).get("reviewStatus").setValue("reviewed");
        this.loadData();
      }
    });
  }

  public toFormGroup(formGroup: AbstractControl): FormGroup {
    return formGroup as FormGroup;
  }

  public get categoriesFormArray(): FormArray {
    return this.taskFormGroup.get("categories") as FormArray;
  }

  public categoryFormGroup(categoryIndex: number): FormGroup {
    return this.categoriesFormArray.controls[categoryIndex] as FormGroup;
  }

  public questionsFormArray(categoryIndex: number): FormArray {
    return this.categoryFormGroup(categoryIndex).get("questions") as FormArray;
  }

  public questionFormGroup(categoryIndex: number): FormGroup {
    return this.questionsFormArray(categoryIndex).controls[0] as FormGroup;
  }

  public choiceFormArray(categoryIndex: number): FormArray {
    return this.questionFormGroup(categoryIndex).get("choices") as FormArray;
  }

  public originalAnswer(compare: string, originalAnswer: string): boolean {
    return compare === originalAnswer;
  }

  public attendeeAnswer(compare: string, attendeeAnswer: string): boolean {
    return compare === attendeeAnswer;
  }

  public get totalScore(): number {
    const categories: Array<TaskCategory> = this.taskFormGroup.value.categories;
    return categories.reduce((pv: number, cv) => {
      return pv + cv.questions[0].reviewerScore || 0;
    }, 0);
  }

  public get totalPoints(): number {
    return this.taskFormGroup.value.categories.reduce((pv: any, cv: any) => pv + cv.points, 0);
  }

  public get allIsAnswered(): boolean {
    const categories: Array<TaskCategory> = this.taskFormGroup.value.categories;
    let totalAnswered = 0;
    categories.forEach((category) => {
      category.questions.forEach((question) => {
        if (question.reviewStatus === "pending") {
          totalAnswered = totalAnswered + 1;
        }
      });
    });
    return totalAnswered === 0;
  }

  public get passed(): boolean {
    return this.totalScore >= this.taskFormGroup.value.generalInfo.passing;
  }

  public replaceIframe(text: string): string {
    return text.replace(/<iframe .*?<\/iframe>/g, "Attachment");
  }

  public expandSection: boolean = false;
  public toggleSections(): void {
    // console.log("categoriesFormArray", this.categoriesFormArray.value);
    this.expandSection = !this.expandSection;

    this.categoriesFormArray.controls.forEach((category, categoryIndex: number) => {
      // console.log("category", category);
      const expand = this.questionFormGroup(categoryIndex).get("expand").value;
      this.questionFormGroup(categoryIndex).get("expand").setValue(this.expandSection);
    });

    // for (const control of this.categoriesFormArray.controls) {
    //   console.log("control", control);
    //   const expand = !control.value.questions[0].expand;
    //   control.setValue(expand);
    // }
  }
}
