import { ChangeDetectorRef, Component, HostListener, OnChanges, OnDestroy, OnInit, SimpleChanges, TemplateRef, ViewChild } from "@angular/core";

import { AccountNavigations, AdminNavigations, INavigation, MarketingNavigations, ReceptionistNavigations, StudentNavigations, TeacherNavigations } from "./data";
import { Router } from "@angular/router";
import { IBranch } from "@isms-core/interfaces";
import { SubSink } from "subsink";

import { Idle, DEFAULT_INTERRUPTSOURCES } from "@ng-idle/core";
import { Keepalive } from "@ng-idle/keepalive";
import { Animations } from "@isms-core/constants";
import { FormControl, FormGroup } from "@angular/forms";
import { environment } from "@isms-env/environment";
import { AccountStore, BranchesStore, SelectedBranchStore } from "@isms-core/ngrx";
import { AuthService, NGRXService } from "@isms-core/services";
import { takeUntil } from "rxjs";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { NzNotificationComponent, NzNotificationService } from "ng-zorro-antd/notification";

@Component({
  selector: "isms-inner-layout",
  templateUrl: "./layout.component.html",
  animations: [Animations.default],
  standalone: false,
})
export class LayoutComponent implements OnInit, OnDestroy, OnChanges {
  private subSink: SubSink = new SubSink();
  public showSubNav: boolean = true;
  public currentRoute!: string;
  public navigations: Array<INavigation> = [];
  public accountNavigations = AccountNavigations;
  public subNavigation: INavigation;
  public selectedBranch: string = null;
  public assignedBranches: Array<IBranch> = [];
  public lockScreenLoaded: boolean = false;
  public idleState = "NOT_STARTED";
  public countdown?: number = null;
  public lastPing?: Date = null;
  public lockScreenFormGroup = new FormGroup({ code: new FormControl(null) });

  constructor(
    private idle: Idle,
    private keepalive: Keepalive,
    private changeDetectorRef: ChangeDetectorRef,

    public readonly accountStore: AccountStore,
    public readonly branchesStore: BranchesStore,
    private readonly router: Router,
    private readonly selectedBranchStore: SelectedBranchStore,
    private readonly authService: AuthService,
    private readonly ngrxService: NGRXService,
    public readonly nzNotificationService: NzNotificationService
  ) {
    this.manageIdle();

    // this.router.events.subscribe((event: Event) => {
    //   if (event instanceof NavigationEnd) {
    //     // this.showSubNav = true;
    //     this.showSubNav = false;
    //     this.currentRoute = event.url;
    //     console.log("currentRoute", this.currentRoute);
    //     this.subNavigation = this.navigations.find((nav) => {
    //       const routeExistInParent = this.currentRoute.indexOf(nav.route) !== -1; //`/${nav.route}` === this.currentRoute;
    //       if (nav.child) {
    //         const routeExistInChild = nav.child.find((child) => {
    //           return child.route === this.currentRoute;
    //         });
    //         const isSelected = routeExistInParent || routeExistInChild;
    //         return isSelected;
    //       }
    //       return nav.child;
    //     });
    //     if (this.subNavigation) {
    //       this.subNavigation["selected"] = true;
    //     }
    //     /* Force hide sub navigation */
    //     if (
    //       [
    //         "/i/candidates/activities",
    //         "/i/pipelines/designer/candidates/123",
    //         "/i/pipelines/designer/automation/123",
    //         "/i/pipelines/designer/hiring-stages/123",
    //         "/i/pipelines/designer/overview/123",
    //         "/i/automations/designer/setup/123",
    //         "/i/candidates/activities/123",
    //         "/i/candidates/bulk-upload/1234"
    //       ].includes(this.currentRoute)
    //     ) {
    //       this.showSubNav = false;
    //     }
    //   }
    // });

    this.subSink.add(
      this.ngrxService.account().subscribe((res) => {
        switch (res.role) {
          case "admin":
            this.navigations = AdminNavigations;
            break;
          case "marketing":
            this.navigations = MarketingNavigations;
            break;
          case "receptionist":
            this.navigations = ReceptionistNavigations;
            break;
          case "student":
            this.navigations = StudentNavigations;
            break;
          case "teacher":
            this.navigations = TeacherNavigations;
            break;
          default:
            break;
        }

        this.manageIdleStarter();
      })
    );
    this.subSink.add(this.ngrxService.assignedBranches().subscribe((res) => (this.assignedBranches = res)));
    this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));
  }

  public ngOnInit(): void {
    this.checkScreenSize();
    this.loadRequiredData();
    this.requestPermission();
    this.listen();
    this.manageIdleStarter();

    this.lockScreenFormGroup
      .get("code")
      .valueChanges.pipe()
      .subscribe(() => (this.lockScreenErrorMessage = ""));
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    console.log("changes");
    this.manageIdleStarter();
  }

  public screenViewType: "mobile" | "desktop" = "desktop";

  @HostListener("window:resize", ["$event"])
  public onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    if (window.innerWidth >= 1024) {
      this.screenViewType = "desktop";
    } else {
      this.screenViewType = "mobile";
    }
  }

  private async loadRequiredData(): Promise<void> {
    /* Connect to  socketio */
    // this.recruiterSocketIOService.connect();
    // const accountResponse = await this.ssoService.account().toPromise();
    // console.log("accountResponse", accountResponse);
    // if (accountResponse.success) {
    //   this.account.update(accountResponse.data);
    // } else {
    //   this.router.navigate(["/a/signin"], { replaceUrl: true });
    // }
    /* load inbox data */
    // this.inboxStore.loadData();
  }

  private async requestPermission(): Promise<void> {
    const messaging = getMessaging();
    getToken(messaging, { vapidKey: environment.firebase.vapidKey })
      .then((currentToken) => {
        if (currentToken) {
          console.log("Hurraaa!!! we got the token.....");
          console.log(currentToken);
        } else {
          console.log("No registration token available. Request permission to generate one.");
        }
      })
      .catch((err) => {
        console.log("An error occurred while retrieving token. ", err);
      });
  }

  @ViewChild("notificationBtnTpl", { static: true }) btnTemplate!: TemplateRef<{ $implicit: NzNotificationComponent }>;
  private listen(): void {
    const messaging = getMessaging();
    onMessage(messaging, (payload) => {
      console.log("Message received. ", payload);

      this.nzNotificationService.blank(payload.notification.title, payload.notification.body, {
        nzKey: "1",
        nzButton: this.btnTemplate,
      });
    });
  }

  public onClickSettingsNavigation(navigation: INavigation): void {
    if (navigation.type) {
      if (navigation.type === "logout") {
        this.authService.logOut();
      } else if (navigation.type === "lockscreen") {
        // do here
        this.idleState = "TIMED_OUT";
        this.idle.stop();
      }
    } else {
      this.router.navigateByUrl(navigation.route);
    }
  }

  public onSelectBranch(branch: IBranch): void {
    this.selectedBranchStore.switch(branch?._id || null);
  }

  public get selectedBranchInfo(): IBranch {
    return this.assignedBranches.find((b) => b._id === this.selectedBranch);
  }

  private manageIdleStarter(): void {
    const enable = this.accountStore.account?.lockScreen?.enable;
    const accountCode = this.accountStore.account?.lockScreen?.code;
    const idleDuration = this.accountStore.account?.lockScreen.idleDuration;

    console.log(accountCode, enable, idleDuration > 1);
    if (accountCode && enable && idleDuration > 1) {
      this.idle.stop();
      setTimeout(() => {
        this.watchIdle();
      }, 500);
    } else {
      this.lockScreenLoaded = true;
    }
  }

  private manageIdle(): void {
    this.idle.setIdle(this.accountStore.account?.lockScreen.idleDuration); // how long can they be inactive before considered idle, in seconds
    this.idle.setTimeout(1); // how long can they be idle before considered timed out, in seconds
    this.idle.setInterrupts(DEFAULT_INTERRUPTSOURCES); // provide sources that will "interrupt" aka provide events indicating the user is active

    // do something when the user becomes idle
    this.idle.onIdleStart.subscribe(() => {
      console.log("IDLE");
      this.idleState = "IDLE";
    });

    // do something when the user is no longer idle
    this.idle.onIdleEnd.subscribe(() => {
      this.idleState = "NOT_IDLE";
      console.log(`${this.idleState} ${new Date()}`);
      this.countdown = null;
      this.changeDetectorRef.detectChanges(); // how do i avoid this kludge?
    });

    // do something when the user has timed out
    this.idle.onTimeout.subscribe(() => {
      console.log("TIMED_OUT");
      this.idleState = "TIMED_OUT";
    });

    // do something as the timeout countdown does its thing
    this.idle.onTimeoutWarning.subscribe((seconds) => (this.countdown = seconds));

    // set keepalive parameters, omit if not using keepalive
    this.keepalive.interval(15); // will ping at this interval while not idle, in seconds
    this.keepalive.onPing.subscribe(() => (this.lastPing = new Date())); // do something when it pings
  }

  private watchIdle(): void {
    // we'll call this method when we want to start/reset the idle process
    // reset any component state and be sure to call idle.watch()
    this.idle.watch();
    this.idleState = "NOT_IDLE";
    this.countdown = null;
    this.lastPing = null;

    this.lockScreenLoaded = true;
  }

  public lockScreenErrorMessage = "";
  public unlockScreen(): void {
    const code = this.lockScreenFormGroup.value.code;
    const accountCode = this.accountStore.account.lockScreen.code;
    if (accountCode === code) {
      this.watchIdle();
      this.lockScreenFormGroup.reset();
    } else {
      this.lockScreenErrorMessage = "Invalid passcode. Please try again.";
    }
  }

  public navigateToStudents(): void {
    this.router.navigateByUrl("/i/students");
    this.nzNotificationService.remove("1");
  }
}
