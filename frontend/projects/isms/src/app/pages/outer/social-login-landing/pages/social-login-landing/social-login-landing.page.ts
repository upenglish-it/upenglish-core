import { AfterViewChecked, AfterViewInit, ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Animations, LocalStorageKeys } from "@isms-core/constants";
import { LocalStorageService, SSOService } from "@isms-core/services";
import { isEmpty } from "lodash";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { lastValueFrom } from "rxjs";

@Component({
  templateUrl: "./social-login-landing.page.html",
  animations: [Animations.down],
  standalone: false,
})
export class SocialLoginLandingPage implements OnInit, AfterViewInit, AfterViewChecked {
  public showCheckedMarkIcon: boolean = false;
  // public authStateInfo: { orgId: string; userId: string; provider: "microsoft" } = null;
  constructor(
    private readonly activatedRoute: ActivatedRoute,
    // private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
    private readonly ssoService: SSOService,
    private readonly localStorageService: LocalStorageService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {
    console.log("this.activatedRoute.snapshot.queryParams", this.activatedRoute.snapshot.queryParams);
    // if (this.activatedRoute.snapshot.queryParams) {
    // console.log(this.activatedRoute.snapshot.queryParams["state"]);
    // this.authStateInfo = JSON.parse(atob(this.activatedRoute.snapshot.queryParams["state"]));
    // console.log("this.authStateInfo", this.authStateInfo);
    // }
  }
  public ngAfterViewInit(): void {
    // this.showCheckedMarkIcon = true;
    // setTimeout(() => {
    //   opener.window.WINDOW_AUTH_DATA = this.activatedRoute.snapshot.queryParams;
    //   self.close();
    // }, 2500);
    // this.cdr.detectChanges();
    this.socialAuthorization();
  }

  public ngAfterViewChecked(): void {}

  public async socialAuthorization(): Promise<void> {
    // Process authentication
    const { code, state, session_state } = this.activatedRoute.snapshot.queryParams;
    await lastValueFrom(
      this.ssoService.socialAuthorization({
        code: code,
        state: state,
        session_state: session_state,
      })
    ).then((res) => {
      console.log("et");

      if (!isEmpty(res)) {
        this.localStorageService.set(LocalStorageKeys.AUTHORIZATION, res.data.authorizationToken);
        const timer = setInterval(() => {
          if (this.localStorageService.get(LocalStorageKeys.AUTHORIZATION)) {
            // this.router.navigateByUrl("/i/dashboard", { replaceUrl: true }); // to prevent go back
            // location.reload(); // refresh the whole app
            location.href = "/dashboard";
            clearInterval(timer);
          }
        }, 100);
      } else {
        this.nzNotificationService.create("error", "Login Authentication", "Unable to login", {
          nzPlacement: "bottomRight",
        });
      }
    });
  }
}
