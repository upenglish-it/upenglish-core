import { Component } from "@angular/core";
import { TaskBuilderComponent } from "@isms-core/components/tasks/task-builder/task-builder.component";

@Component({
  selector: "isms-task-builder-page",
  templateUrl: "./builder.page.html",
  imports: [TaskBuilderComponent],
})
export class BuilderPage {}
