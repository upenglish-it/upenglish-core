import { Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation } from "@angular/core";
import { JsonPipe, NgClass, NgFor, NgIf } from "@angular/common";
import { ActivatedRoute } from "@angular/router";
import { Alphabet, Animations, ParticipantRTinyMCEConfig } from "@isms-core/constants";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzProgressModule } from "ng-zorro-antd/progress";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzBadgeModule } from "ng-zorro-antd/badge";
import { NgxTinymceModule } from "ngx-tinymce";
import { FormArray, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { TinyMCEIFrameFullHeightDirective } from "@isms-core/directives";
import { NzDividerModule } from "ng-zorro-antd/divider";
import { TasksSubmissionsService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { SetTaskFormGroup, TaskFormGroup } from "@isms-core/form-group";
import { DateTime, Duration } from "luxon";
import { SubSink } from "subsink";
import { TaskSubmission } from "@isms-core/interfaces";
import { NzModalModule, NzModalService } from "ng-zorro-antd/modal";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzSpinModule } from "ng-zorro-antd/spin";
import { isEmpty } from "lodash";
@Component({
  selector: "isms-taking-task",
  templateUrl: "./taking-task.component.html",
  styleUrls: ["./taking-task.component.scss"],
  encapsulation: ViewEncapsulation.None,
  animations: [Animations.down],
  imports: [
    NgIf,
    NgFor,
    NgClass,
    JsonPipe,
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzIconModule,
    NzDividerModule,
    NzProgressModule,
    NzModalModule,
    NzTagModule,
    NzBadgeModule,
    NzSpinModule,

    NgxTinymceModule,
    TinyMCEIFrameFullHeightDirective,
  ],
})
export class TakingTaskComponent implements OnInit {
  @Output("on-completed") onCompleted: EventEmitter<string> = new EventEmitter();
  @Input("submission-id") public submissionId: string;
  private subSink = new SubSink();
  public readonly alphabet = Alphabet;
  public readonly participantRTinyMCEConfig = ParticipantRTinyMCEConfig;
  public readonly taskFormGroup: FormGroup = TaskFormGroup();
  public timerText = "";

  // public description: string = `<h1><strong>The English Master Course: Learn English Grammar, English Speaking, English Punctuation, and English pronunciation.</strong></h1> <p><a href="https://phosphoricons.com/">https://phosphoricons.com</a></p> <p>&nbsp;</p> <h3><strong>Udemy's best-selling English course! 💯</strong></h3> <p>&nbsp;</p> <p><strong><iframe style="width: 1022px; height: 573px; display: table; margin-left: auto; margin-right: auto;" src="https://www.youtube.com/embed/OtWciKwlaG8" width="1022" height="573" allowfullscreen="allowfullscreen"></iframe></strong></p> <h2><video style="width: 564px; height: 282px;" controls="controls" width="564" height="282"> <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4"></video></h2> <p>&nbsp;</p> <p><iframe src="https://www.youtube.com/embed/-mDIIQfGfmY" width="560" height="314" allowfullscreen="allowfullscreen"></iframe></p> <p>&nbsp;</p> <p><a href="1">http://localhost:4200/tasks/userid/1</a></p> <p>&nbsp;</p> <p>&nbsp;</p> <p>&nbsp;</p> <p><iframe src="https://www.youtube.com/embed/UQayQl05lkc" width="560" height="314" allowfullscreen="allowfullscreen"></iframe></p> <table style="border-collapse: collapse; width: 100%; height: 34.5938px; background-color: rgb(244, 244, 244); border: 1px ridge rgb(241, 196, 15);" border="1"><caption> <h2><strong>Our Services</strong></h2> </caption><colgroup><col style="width: 25%;"><col style="width: 25%;"><col style="width: 25%;"><col style="width: 25%;"></colgroup> <tbody> <tr style="height: 16.7969px;"> <td style="height: 16.7969px; border-width: 1px; border-color: rgb(241, 196, 15);"><strong>Monday</strong></td> <td style="height: 16.7969px; border-width: 1px; border-color: rgb(241, 196, 15);"><strong>Monday</strong></td> <td style="height: 16.7969px; border-width: 1px; border-color: rgb(241, 196, 15);"><strong>Monday</strong></td> <td style="height: 16.7969px; border-width: 1px; border-color: rgb(241, 196, 15);"><strong>Monday</strong></td> </tr> <tr style="height: 17.7969px;"> <td style="height: 17.7969px; border-width: 1px; border-color: rgb(241, 196, 15);"><strong>Monday</strong></td> <td style="height: 17.7969px; border-width: 1px; border-color: rgb(241, 196, 15);"><strong>Monday</strong></td> <td style="height: 17.7969px; border-width: 1px; border-color: rgb(241, 196, 15);"><strong>Monday</strong></td> <td style="height: 17.7969px; border-width: 1px; border-color: rgb(241, 196, 15);"><strong>Monday</strong></td> </tr> </tbody> </table> <p>&nbsp;</p> <p><strong>**New 2023 Update</strong>: Brand new accent training section added. Build the perfect American or British accent.</p> <p>Over 500 new grammar/IELTS/TOEFL interactive practice questions added.<strong>**</strong></p> <p><iframe src="https://www.youtube.com/embed/joRVkFrxuS4" width="560" height="314" allowfullscreen="allowfullscreen"></iframe></p> <p><strong>Are you ready to master the English language?</strong>&nbsp;Are you tired of learning the same simple topics and never really getting better at English speaking or English grammar? This course will fix all those problems. This has been one of the top Udemy English courses for many years, and that is because we care about our students.</p> <ul> <li>The English master course covers all areas of English learning. English grammar, English speaking, and English writing (punctuation). There are over 40 hours of video lessons, hundreds of examples and practice problems, and full-length PDFs.</li> <li>This course is HUGE. Basically 4 courses in 1.</li> </ul> <ol> <li><strong>English Grammar Section:&nbsp;</strong>Over 90 different English grammar topics. No other course covers as many English Grammar topics. Full video lessons and conversations showing you the English grammar in use. You will learn to score higher on your English exams like TOEIC, IELTS, or TOEFL. Hundred of practice problems and examples. Full-length PDFs for offline learning.</li> <li>asdas</li> <li>asd</li> <li>adds</li> </ol> <p>😎&nbsp;</p> <p><strong><em><span style="text-decoration: underline;">sa dasdas dasasd</span></em></strong></p> <p><strong>English Speaking Section:&nbsp;</strong>Learn to speak like a native English speaker. Learn how to talk about 27 different topics. Learn hundreds of new English vocabulary, verbs, and phrases. Improve your accent and gain confidence while speaking.&nbsp;<strong>Includes American and British audio</strong>&nbsp;so you can pick which accent to learn. 75 full-length real conversations with native English speakers allowing you to truly master the English language.</p> <p><strong>English Writing Section:</strong>&nbsp;Learn the grammar behind English sentences and their different structures. Master all 14 English punctuation marks so you can write better and more professionally. Get that new pipeline you want or better grades in school. Hundreds of examples and writing practice problems. Full-length PDFs and video lessons.</p> <p><strong>English Pronunciation Section:</strong>&nbsp;Build the perfect English accent. The accent training section covers all the sounds of the English language. Learn how to make each sound correctly. In addition, train your accent with professional voice actors using state-of-the-art accent training activities. Pick an American or British accent.</p> <p><strong>After using this course</strong>, you will ace tough English grammar tests such as A1, A2, B1, B2, C1, TOEFL, IETLS, AND TOEIC. You will sound more professional at work and may even get that new pipeline or promotion you want. You will impress people with your new advanced English level. Your English grammar, English speaking, and English writing will all improve. You will develop a British or American accent and sound fluent.</p> <p><strong>Students love this course. See what some of them have to say about it:</strong></p> <p>Verberly C.</p> <p>***** - 5 stars</p> <p>"I have been using Course for success for over 2 years now, it was relevant then and even more so now, I always refer now and again to refresh my skills. The instructions are lessons are easy to follow and I am happy to be able to learn at my own pace."</p> <p>Sandesh K</p> <p>***** - 5 stars</p> <p>"I'm a newbie in this course and really enjoying it. The best part is that the instructor is always there to answer your question don't matter how many times you ask."</p> <p><strong>This is a SUPER course. 4 full courses in 1. You get English grammar, English speaking, English writing, and English pronunciation.</strong></p> <p>Great for all levels. Beginners, intermediate, and advanced.</p> <p>I guarantee everything you need to become a PRO English language user is in this English master Course. This is the only course that teaches you&nbsp;<strong>English grammar in use</strong>&nbsp;and also shows you how to use it in real&nbsp;<strong>English speaking and conversation&nbsp;</strong>so you can improve all areas of the English language.</p> <p>Every topic has dozens of useful&nbsp;<strong>English&nbsp;</strong>examples, video lectures, guided practice, and real-life English conversations. Hundreds of worksheet pdfs full of practice problems to help you&nbsp;<strong>learn the English language.</strong></p> <p>The creator of this course is a real-life university professor and will answer any questions you have 24/7. Start learning English the easy way! Add the course to your cart and we can begin.</p> <p>-----------------</p> <p>Message from Scott, the course creator:</p> <p>Hello, all native English language enthusiasts with the zeal to learn English grammar, use punctuation marks for writing, and become the best at speaking English. I welcome you all to my course page. I have been teaching the English language for many years and have seen most people are still insecure about their use of English. It is possible to master English grammar and English speaking. I will help you be confident when you speak and write.</p> <p>This English language course is the perfect tool for anyone who wants to scale through every phase of English learning seamlessly. Ideal for anyone interested in information regarding the English language &ndash; how to learn English &ndash; English grammar &ndash; spoken English &ndash; English speaking &ndash; English writing &ndash; English punctuation &ndash; and English pronunciation. I am happy to share my course with you and be part of your journey to be fluent in English grammar, English speaking, English writing, and English pronunciation.</p> <p>With all my experience teaching English language students to the advanced level, I will guide you through the journey of mastering English grammar, speaking, and writing.</p> <p>I hope to see you all in the course.</p> <p>Good luck!</p> <p><strong>Langpill | Learn English | Speaking | Listening | Writing | Pronunciation</strong></p>`;

  // public staffPayslip: IStaffPayslip = null;
  public submittingParticipantAnswer: boolean = false;

  public timesUpModal: boolean = false;
  public loadingTimesUpButton: boolean = false;
  public seeMoreTimer: boolean = true;

  public showDescription: boolean = false;

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly tasksSubmissionsService: TasksSubmissionsService,
    private readonly nzNotificationService: NzNotificationService,
    private readonly nzModalService: NzModalService
  ) {}

  public ngOnInit(): void {
    this.subSink.add(
      this.taskFormGroup.valueChanges.pipe(debounceTime(1000), distinctUntilChanged()).subscribe((value) => {
        const taskSubmission: TaskSubmission = { task: { _id: value._id, categories: value.categories } } as any;

        // taskSubmission.task.categories.filter((category) => category.questions.filter((question) => !question.enableOpenAI && question.type === "fill-in"));

        taskSubmission.task.categories.map((category) => {
          delete category.id;
          delete category.title;
          const questions = category.questions.map((question) => {
            return { ...question, attendeeAnswer: question.attendeeAnswer };
          });
          category.questions = questions as any;
          return category;
        });

        // taskSubmission.task.categories.filter((category) => category.questions.filter((question) => !isEmpty(question.attendeeAnswer)));

        if (this.taskFormGroup.value.editing.categoryIndex === this.categoriesFormArray.value.length) {
          this.submittingParticipantAnswer = true;
        }
        lastValueFrom(this.tasksSubmissionsService.updateCategoriesById({ taskSubmission: taskSubmission }, this.submissionId)).then((res) => {
          this.submittingParticipantAnswer = false;
          if (res.success) {
            if (this.taskFormGroup.value.editing.categoryIndex === this.categoriesFormArray.value.length) {
              this.onCompleted.emit(this.submissionId);
            }
          }
        });
      })
    );
    lastValueFrom(this.tasksSubmissionsService.fetchById(this.submissionId)).then((res) => {
      if (res.success) {
        SetTaskFormGroup(this.taskFormGroup, res.data.task, true);
        this.taskFormGroup.get("editing").get("categoryIndex").setValue(0);
        this.taskFormGroup.get("editing").get("questionIndex").setValue(0);

        if (this.taskFormGroup.value.generalInfo.type === "challenge") {
          this.startCountdown();
        }

        this.showDescriptionMode();
      }
    });
  }

  private startCountdown(): void {
    const type = this.taskFormGroup.value.generalInfo.duration.type;
    const value = this.taskFormGroup.value.generalInfo.duration.value;
    let endTime = DateTime.now().plus({ ...(type === "hour" ? { hours: value } : null), ...(type === "minute" ? { minutes: value } : null) });
    // let endTime = DateTime.now().plus({ seconds: 10 });
    const interval = setInterval(() => {
      const now = DateTime.now();
      const remaining = endTime.diff(now);
      // console.log(remaining.toFormat(`d'd' h'h' m'm' ss`));

      // const seconds = remaining.toFormat("s");

      // Extract minutes and seconds
      const duration = Duration.fromObject({ seconds: parseInt(remaining.toFormat("s")) });
      const minutes = Math.floor(duration.as("minutes"));
      const remainingSeconds = Math.floor(duration.seconds % 60);
      const seconds = `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;

      this.timerText = `${seconds}`;

      if (seconds === "0" || seconds.includes("-")) {
        clearInterval(interval);
        // alert("oops timesup");
        // this.onCompleted.emit(this.submissionId);
        // show times up
        this.toggleTimesUpModal();
      }
    }, 1000);
  }

  public onBack(): void {
    const categoryIndex = this.taskFormGroup.value.editing.categoryIndex;
    this.taskFormGroup
      .get("editing")
      .get("categoryIndex")
      .setValue(categoryIndex - 1);
    this.showDescriptionMode();
  }

  public onNext(): void {
    // const categoryIndex = this.taskFormGroup.value.editing.categoryIndex;
    const categoryIndex = this.taskFormGroup.value.editing.categoryIndex;

    // if (this.taskFormGroup.value.editing.categoryIndex + 1 === this.categoriesFormArray.value.length) {
    //   this.onCompleted.emit(this.submissionId);
    // } else {
    this.taskFormGroup
      .get("editing")
      .get("categoryIndex")
      .setValue(categoryIndex + 1);

    this.showDescriptionMode();
    // }
  }

  public showDescriptionMode(): void {
    this.showDescription = false;
    const timer = setTimeout(() => {
      this.showDescription = !this.showDescription;
      clearTimeout(timer);
    }, 1000);
  }

  public toggleTimesUpModal(): void {
    this.timesUpModal = !this.timesUpModal;
  }

  public goToTaskResult(): void {
    this.loadingTimesUpButton = true;
    lastValueFrom(this.tasksSubmissionsService.reviewParticipantAnswer(this.submissionId)).then((res) => {
      this.loadingTimesUpButton = false;
      if (res.success) {
        this.onCompleted.emit(this.submissionId);
      } else {
        this.nzNotificationService.error("Task Result", res.message);
      }
    });
  }

  public close(): void {
    window.close();
  }

  public get categoriesFormArray(): FormArray {
    return this.taskFormGroup.get("categories") as FormArray;
  }

  public get categoryFormGroup(): FormGroup {
    return this.categoriesFormArray.controls[this.taskFormGroup.value.editing.categoryIndex] as FormGroup;
  }

  public get questionsFormArray(): FormArray {
    return this.categoryFormGroup?.get("questions") as FormArray;
  }

  public get questionFormGroup(): FormGroup {
    return this.questionsFormArray?.controls[0] as FormGroup;
  }

  public formatOne = (percent: number): string => `${this.taskFormGroup.value.editing.categoryIndex + 1}/${this.categoriesFormArray.value.length}`;

  public submit() {
    this.nzModalService.confirm({
      nzBodyStyle: { "padding-left": "16px", "padding-right": "16px", "padding-bottom": "10px", "padding-top": "16px" },
      nzTitle: "Are you sure you want to submit?",
      nzOkText: "Confirm",
      nzOkType: "primary",
      nzOkDanger: true,
      nzCancelText: "No, Leave it",
      nzOnCancel: () => {},
      nzOnOk: () => {
        this.goToTaskResult();
      },
    });
  }
}
