import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { TasksService, TasksSubmissionsService } from "@isms-core/services";
import { Animations } from "@isms-core/constants";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzBadgeModule } from "ng-zorro-antd/badge";
import { TaskResultComponent } from "@isms-core/components/tasks/task-result/task-result.component";

@Component({
  templateUrl: "./task-report.page.html",
  animations: [Animations.down],
  styles: [
    `
      @media print {
        #back-button,
        #printbutton {
          display: none;
        }
      }
    `,
  ],
  imports: [NzTagModule, NzCollapseModule, NzButtonModule, NzDropDownModule, NzIconModule, NzBadgeModule, TaskResultComponent],
})
export class TaskReportPage implements OnInit {
  public submissionId: string | null = null;

  constructor(
    private readonly tasksService: TasksService,
    private readonly tasksSubmissionsService: TasksSubmissionsService,
    private readonly activatedRoute: ActivatedRoute,
    private router: Router
  ) {}

  public ngOnInit(): void {
    this.submissionId = this.activatedRoute.snapshot.paramMap.get("submissionId");
  }

  public goBack() {
    const taskId = this.activatedRoute.parent.snapshot.queryParamMap.get("taskId");
    this.router.navigateByUrl(`/i/tasks/${taskId}/submissions`);
  }

  public printWindow() {
    window.print();
  }
}
