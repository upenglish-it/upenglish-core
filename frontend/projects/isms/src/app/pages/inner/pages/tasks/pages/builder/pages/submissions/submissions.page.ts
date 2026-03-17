import { Component } from "@angular/core";
import { Animations } from "@isms-core/constants";
import { NgIf } from "@angular/common";
import { TaskSubmissionsComponent } from "@isms-core/components/tasks/task-submissions/task-submissions.component";

@Component({
  selector: "isms-task-submissions-page",
  templateUrl: "./submissions.page.html",
  animations: [Animations.down, Animations.default],
  imports: [NgIf, TaskSubmissionsComponent],
})
export class SubmissionsPage {}
