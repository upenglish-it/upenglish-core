import { Component, OnDestroy, OnInit } from "@angular/core";
import { NGRXService, NotificationsService } from "@isms-core/services";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzModalModule } from "ng-zorro-antd/modal";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { onBackgroundMessage } from "firebase/messaging/sw";
import { environment } from "@isms-env/environment";
import { isEmpty } from "lodash";
import { SubSink } from "subsink";
import { IAccount } from "@isms-core/interfaces";
import { lastValueFrom } from "rxjs";
@Component({
  selector: "isms-system-notification-activation-modal",
  templateUrl: "./system-notification-activation-modal.component.html",
  imports: [NzModalModule, NzButtonModule],
})
export class SystemNotificationActivationModalComponent implements OnInit, OnDestroy {
  private subSink: SubSink = new SubSink();
  public showModal: boolean = false;
  public gcmToken: string = null;
  private account: IAccount = null;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly ngrxService: NGRXService
  ) {
    this.subSink.add(this.ngrxService.account().subscribe((res) => (this.account = res)));
  }

  public ngOnInit(): void {
    this.requestPermission();
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  public toggle(): void {
    this.showModal = !this.showModal;
  }

  public accept(enable: boolean): void {
    lastValueFrom(this.notificationsService.update({ ...this.account.notification, gcm: enable })).then();
    this.toggle();
  }

  private async requestPermission(): Promise<void> {
    const messaging = getMessaging();
    getToken(messaging, { vapidKey: environment.firebase.vapidKey })
      .then((token) => {
        if (!isEmpty(token)) {
          console.log("Hurraaa!!! we got the token.....");
          console.log(token);
          this.gcmToken = token;
          console.log(this.account);
          if (this.account.gcmToken) {
            lastValueFrom(this.notificationsService.updateGCM(this.gcmToken)).then();
          } else {
            this.toggle();
          }
        } else {
          console.log("No registration token available. Request permission to generate one.");
        }
      })
      .catch((err) => {
        console.log("An error occurred while retrieving token. ", err);
      });
  }

  private listen(): void {
    const messaging = getMessaging();
    onMessage(messaging, (payload) => {
      console.log("Message received. ", payload);
    });
  }
}
