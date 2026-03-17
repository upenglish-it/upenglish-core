import { Component } from "@angular/core";
import { TaskSettingsComponent } from "@isms-core/components/tasks/task-settings/task-settings.component";

@Component({
  selector: "isms-task-settings-page",
  templateUrl: "./settings.page.html",
  imports: [TaskSettingsComponent],
})
export class SettingsPage {}
