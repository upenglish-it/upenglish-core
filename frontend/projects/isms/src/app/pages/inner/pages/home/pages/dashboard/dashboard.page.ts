import { DatePipe, NgClass, NgFor, NgIf } from "@angular/common";
import { Component } from "@angular/core";
import { AnnouncementsService } from "@isms-core/services";
import { Animations } from "@isms-core/constants";
import { AccountStore } from "@isms-core/ngrx";
import { DateTime } from "luxon";
import { NzTagModule } from "ng-zorro-antd/tag";
import { StudentDashboardComponent } from "@isms-core/components/dashboard/student-dashboard/student-dashboard.component";
import { RemoveComponentTagDirective } from "@isms-core/directives";
import { AdminDashboardComponent } from "@isms-core/components/dashboard/admin-dashboard/admin-dashboard.component";
import { TeacherDashboardComponent } from "@isms-core/components/dashboard/teacher-dashboard/teacher-dashboard.component";
import { ReceptionistDashboardComponent } from "@isms-core/components/dashboard/receptionist-dashboard/receptionist-dashboard.component";
import { MarketingDashboardComponent } from "@isms-core/components/dashboard/marketing-dashboard/marketing-dashboard.component";

@Component({
  templateUrl: "./dashboard.page.html",
  animations: [Animations.down],
  imports: [
    NgClass,
    NgIf,
    NgFor,
    DatePipe,
    NzTagModule,
    StudentDashboardComponent,
    AdminDashboardComponent,
    TeacherDashboardComponent,
    ReceptionistDashboardComponent,
    MarketingDashboardComponent,
    RemoveComponentTagDirective,
  ],
})
export class DashboardPage {
  public searchShortcutKey = navigator.userAgent.indexOf("Mac OS X") != -1 ? ["⌘", "K"] : ["⊞", "K"];
  public greetingMessage = "Good day";
  public currentDate = DateTime.now().toISO();

  constructor(
    private readonly announcementsService: AnnouncementsService,
    public readonly accountStore: AccountStore
  ) {}

  public ngOnInit(): void {
    this.loadGreeting();
  }

  public loadGreeting(): void {
    const currentTime = DateTime.local();
    // Get the hour of the current time
    const currentHour = currentTime.hour;
    if (currentHour >= 18) {
      this.greetingMessage = "Good evening";
    } else if (currentHour >= 12) {
      this.greetingMessage = "Good afternoon";
    } else {
      this.greetingMessage = "Good morning";
    }
  }
}
