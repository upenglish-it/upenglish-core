import { DatePipe, NgFor, NgIf } from "@angular/common";
import { AfterViewInit, Component, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { TasksService, TasksSubmissionsService } from "@isms-core/services";
import { Animations } from "@isms-core/constants";
import { lastValueFrom } from "rxjs";
import { Task } from "@isms-core/interfaces";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import { NzIconModule } from "ng-zorro-antd/icon";
import { ReviewTaskSubmissionModalComponent } from "@isms-core/components/tasks/review-task-submission-modal/review-task-submission-modal.component";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzBadgeModule } from "ng-zorro-antd/badge";

@Component({
  templateUrl: "./tasks.page.html",
  animations: [Animations.down],
  styles: [
    `
      .banner-header {
        width: 100%;
        height: 200px;
        position: absolute;
        background-image: linear-gradient(#ff7c6e, #ff3823);
        border-bottom-left-radius: 50% 20%;
        border-bottom-right-radius: 50% 20%;
      }
      .banner-container {
        width: 100%;
        height: 50vh;
        background-color: white;
        /* border-radius: 10px; */
        position: absolute;
        overflow: hidden;
      }
    `,
  ],
  imports: [NgIf, NgFor, DatePipe, NzTagModule, NzCollapseModule, RouterLink, NzButtonModule, NzDropDownModule, NzIconModule, NzBadgeModule, ReviewTaskSubmissionModalComponent],
})
export class TasksPage implements OnInit, AfterViewInit {
  @ViewChild("reviewTaskSubmissionModal") reviewTaskSubmissionModal: ReviewTaskSubmissionModalComponent;

  public tasks: Array<Task> = [];

  constructor(
    private readonly router: Router,
    private readonly tasksService: TasksService,
    private readonly tasksSubmissionsService: TasksSubmissionsService,
    private readonly activatedRoute: ActivatedRoute
  ) {}

  public ngOnInit(): void {
    lastValueFrom(this.tasksService.participantTasks()).then((res) => {
      this.tasks = res.success
        ? (res.data as Array<Task>).map((task) => {
            // task.categories.map((category) => {
            //   category.questions.map((question) => {
            //     question.
            //   })
            // })

            const categories = task.categories;
            let totalAnswered = 0;
            categories.forEach((category) => {
              category.questions.forEach((question) => {
                if (question.reviewStatus === "pending") {
                  totalAnswered = totalAnswered + 1;
                }
              });
            });

            return task;
          })
        : [];
    });
  }

  public ngAfterViewInit(): void {
    const tasksSubmissionId = this.activatedRoute.snapshot.queryParams["tasksSubmission"];
    console.log("tasksSubmissionId", tasksSubmissionId);

    if (tasksSubmissionId) {
      // setTimeout(() => {
      this.showSubmissionResult(tasksSubmissionId);
      // }, 1500);
    }
  }

  public loadSubmissions(taskIndex: number): void {
    const task = this.tasks[taskIndex];
    lastValueFrom(this.tasksSubmissionsService.participantSubmissions(task._id)).then((res) => {
      if (res.success) {
        this.tasks.at(taskIndex)["submissions"] = res.data;
      }
    });
  }

  public backToHome(): void {
    this.router.navigateByUrl("i/dashboard");
  }

  public showSubmissionResult(submissionId: string): void {
    this.reviewTaskSubmissionModal.toggle();
    this.reviewTaskSubmissionModal.submissionId = submissionId;
  }
}
