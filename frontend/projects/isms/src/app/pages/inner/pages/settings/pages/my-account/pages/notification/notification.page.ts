import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { AccountStore } from "@isms-core/ngrx";
import { NGRXService, NotificationsService, SSOService } from "@isms-core/services";
import { lastValueFrom } from "rxjs";
import { SubSink } from "subsink";

@Component({
  templateUrl: "./notification.page.html",
  standalone: false,
})
export class NotificationPage implements OnInit, OnDestroy {
  private subSink: SubSink = new SubSink();
  public notificationFormGroup: FormGroup;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly ngrxService: NGRXService,
    private readonly ssoService: SSOService
  ) {}

  public ngOnInit(): void {
    this.initializeFormGroup();
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  private initializeFormGroup(): void {
    this.notificationFormGroup = new FormGroup({
      softwareUpdates: new FormControl(false),
      gcm: new FormControl(false),

      /* marketing */
      payslip: new FormControl(false),
      leadConversation: new FormControl(false),
      salaryModification: new FormControl(false),
      wonLose: new FormControl(false),
      leadCreation: new FormControl(false),
      leaveApproval: new FormControl(false),
    });

    this.notificationFormGroup.valueChanges.pipe().subscribe((value) => {
      lastValueFrom(this.notificationsService.update(value)).then();
    });

    lastValueFrom(this.ssoService.account()).then((res) => {
      this.notificationFormGroup.setValue(res.data.account.notification, { emitEvent: false });
    });
  }

  public onSubmit(): void {}
}
