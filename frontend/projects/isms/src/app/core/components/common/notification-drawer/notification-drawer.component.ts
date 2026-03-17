import { NgClass, NgFor, NgIf } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { INotification } from "@isms-core/interfaces";
import { TimeAgoPipe } from "@isms-core/pipes";
import { NotificationsService } from "@isms-core/services";
import { NzBadgeModule } from "ng-zorro-antd/badge";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { lastValueFrom } from "rxjs";

@Component({
  selector: "isms-notification-drawer",
  templateUrl: "./notification-drawer.component.html",
  imports: [NgClass, NgIf, NgFor, RouterModule, NzDrawerModule, NzButtonModule, NzBadgeModule, TimeAgoPipe],
})
export class NotificationDrawerComponent implements OnInit {
  public notifications: Array<INotification> = [];
  public showDrawer: boolean = false;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly router: Router
  ) {}

  public ngOnInit(): void {
    this.loadData();
  }

  public loadData(): void {
    lastValueFrom(this.notificationsService.fetch()).then((res) => {
      this.notifications = res.success ? res.data : [];
    });
  }

  public toggle(): void {
    this.showDrawer = !this.showDrawer;
  }

  public onSelectNotification(notification: INotification): void {
    if (notification.actionType === "student-receipt") {
      this.router.navigateByUrl(`/pop/student-receipt?urlCode=${notification.data.urlCode}`);
    }
    if (notification.actionType === "staff-payslip") {
      this.router.navigateByUrl(`/pop/staff-payslip?urlCode=${notification.data.urlCode}`);
    }
    if (notification.actionType === "assign-task-to-reviewer") {
      this.router.navigateByUrl("/i/tasks");
    }

    if (notification.actionType === "assign-task-to-participant") {
      this.router.navigateByUrl(`/tasks`);
    }

    if (notification.actionType === "participant-submit-task") {
      this.router.navigateByUrl(`/i/tasks/${notification.data.taskId}/submissions`);
    }

    if (notification.actionType === "reviewer-reviewed-submitted-task") {
      this.router.navigateByUrl(`/tasks?tasksSubmission=${notification.data.tasksSubmission}`);
    }

    if (notification.actionType === "lead-changes-in-pipeline") {
      const type = (notification.data && (notification.data as any).type) || "leads";
      this.router.navigateByUrl(`/i/pipelines/designer/pipeline/${notification.data.pipelineId}/${type}`);
    }

    this.toggle();
  }
}
