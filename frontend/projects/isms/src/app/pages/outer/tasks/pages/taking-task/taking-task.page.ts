import { Component, HostListener, OnInit, ViewChild } from "@angular/core";
import { JsonPipe, NgIf } from "@angular/common";
import { ActivatedRoute } from "@angular/router";
import { TakingTaskComponent } from "@isms-core/components/tasks/taking-task/taking-task.component";
import { TaskResultComponent } from "@isms-core/components/tasks/task-result/task-result.component";
import { TasksService, TasksSubmissionsService } from "@isms-core/services";
import { lastValueFrom } from "rxjs";
import { FormGroup } from "@angular/forms";
import { SetTaskFormGroup, TaskFormGroup } from "@isms-core/form-group";
import { ConfirmTakeTaskModalComponent } from "@isms-core/components/tasks/confirm-take-task-modal/confirm-take-task-modal.component";
import { Task } from "@isms-core/interfaces";

@Component({
  templateUrl: "./taking-task.page.html",
  imports: [NgIf, JsonPipe, TakingTaskComponent, TaskResultComponent, ConfirmTakeTaskModalComponent],
})
export class TakingTaskPage implements OnInit {
  @ViewChild("confirmTakeTaskModal") private readonly confirmTakeTaskModal: ConfirmTakeTaskModalComponent;
  public taskFormGroup: FormGroup = TaskFormGroup();
  public stepView: "preparing-task" | "taking-task" | "finished-task" = "preparing-task";
  public submissionId: string = null;

  constructor(
    private readonly tasksService: TasksService,
    private readonly tasksSubmissionsService: TasksSubmissionsService,
    private readonly activatedRoute: ActivatedRoute
  ) {}

  public ngOnInit(): void {
    const urlCode = this.activatedRoute.snapshot.paramMap.get("id");
    lastValueFrom(this.tasksService.fetchById(urlCode)).then((res) => {
      if (res.success) {
        SetTaskFormGroup(this.taskFormGroup, res.data, true);
      }
    });
    // this.setTemporaryResult();

    history.pushState(null, document.title, location.href);
    window.addEventListener("popstate", function (event) {
      history.pushState(null, document.title, location.href);
    });
  }

  public setTemporaryResult(): void {
    // this.confirmTakeTaskModal.toggle();
    this.submissionId = "UPE01HDTF8A29DGY1Z9759M39RD40";
    this.stepView = "finished-task";
  }

  public onGenerated(task: Task): void {
    lastValueFrom(this.tasksSubmissionsService.create(task)).then((res) => {
      // this.tasks = res.success ? res.data : [];
      if (res.success) {
        // SetTaskFormGroup(this.taskFormGroup, res.data);
        this.submissionId = res.data._id;
        this.stepView = "taking-task";
        this.confirmTakeTaskModal.toggle();
      }
    });
  }

  public onCompleted(taskId: string): void {
    this.stepView = "finished-task";
  }

  @HostListener("window: beforeunload", ["$event"])
  public unloadHandler(event: Event): void {
    event.preventDefault();
  }

  @HostListener("window:popstate", ["$event"])
  onPopState(event: Event) {
    history.pushState(null, "", location.href);
  }
}
