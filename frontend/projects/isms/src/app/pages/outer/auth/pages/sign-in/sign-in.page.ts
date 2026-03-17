// Angular imports
import { isEmpty } from "lodash";
import { Router } from "@angular/router";
import { Component, inject } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { NzNotificationService } from "ng-zorro-antd/notification";
// Types
import { SSOProviderT } from "@isms-core/types";
// Constants
import { Animations, LocalStorageKeys } from "@isms-core/constants";
// Services
import { LocalStorageService, SocialLoginService } from "@isms-core/services";
@Component({
  templateUrl: "./sign-in.page.html",
  animations: [Animations.down],
  standalone: false,
})
export class SignInPage {
  public signInFormGroup: FormGroup;
  public loading: boolean = false;
  public googleLoading: boolean = false;

  constructor(
    private readonly router: Router,
    private readonly nzNotificationService: NzNotificationService,
    private readonly localStorageService: LocalStorageService
  ) {}
  private readonly socialLoginService: SocialLoginService = inject(SocialLoginService);

  public ngOnInit(): void {
    this.signInFormGroup = new FormGroup({});
  }

  public async loginWithSSO(provider: SSOProviderT): Promise<void> {
    if (provider === "microsoft") {
      this.loading = true;
    } else {
      this.googleLoading = true;
    }
    this.socialLoginService
      .authenticate({ provider })
      .then((res) => {
        if (!isEmpty(res)) {
          this.localStorageService.set(LocalStorageKeys.AUTHORIZATION, res.authorizationToken);
          const timer = setInterval(() => {
            if (this.localStorageService.get(LocalStorageKeys.AUTHORIZATION)) {
              this.router.navigateByUrl("/i/dashboard", { replaceUrl: true }); // to prevent go back
              location.reload(); // refresh the whole app
              clearInterval(timer);
            }
          }, 100);
        } else {
          this.nzNotificationService.create("error", "Login Authentication", "Unable to login", {
            nzPlacement: "bottomRight",
          });
        }
      })
      .catch(() => {
        this.nzNotificationService.create("error", "Login Authentication", "Unable to process your request at this time. Please try again later", {
          nzPlacement: "bottomRight",
        });
      })
      .finally(() => {
        this.loading = false;
        this.googleLoading = false;
      });
  }
}
