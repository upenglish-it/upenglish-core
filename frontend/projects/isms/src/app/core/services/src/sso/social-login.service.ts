// Services
import { SSOService } from ".";
// Types
import { SSOProviderT } from "@isms-core/types";
// Angular imports
import { lastValueFrom } from "rxjs";
import { Injectable } from "@angular/core";
import { NzNotificationService } from "ng-zorro-antd/notification";

@Injectable({
  providedIn: "root",
})
export class SocialLoginService {
  constructor(
    private readonly ssoService: SSOService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public async authenticate(payload: { provider: SSOProviderT }): Promise<{ authorizationToken: string }> {
    return new Promise(async (resolve, reject) => {
      // Generate Redirection URI
      const generateRedirection = await lastValueFrom(this.ssoService.signIn(payload));

      if (generateRedirection.success) {
        window.location.href = generateRedirection.data.redirectURI;
        // const windowWidth = 620;
        // const windowHeight = 720;

        // const winPosLeft = (screen.width - windowWidth) / 2;
        // const winPosTop = (screen.height - windowHeight) / 2;

        // const authenticationWindow: Window = window.open(
        //   generateRedirection.data.redirectURI,
        //   "_blank",
        //   `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=${windowWidth}, height=${windowHeight}, top=${winPosTop}, left=${winPosLeft}`
        // );

        // const timer = setInterval(async () => {
        //   if (authenticationWindow.closed) {
        //     const authData: WindowAuthData = (window as any).WINDOW_AUTH_DATA || null;
        //     clearInterval(timer);

        //     console.log("authData", JSON.stringify(authData));
        //     if (authData) {
        //       // this.nzNotificationService.create("success", "Successful Authentication", "Please wait while processing the calendar data.", {
        //       //   nzPlacement: "bottomRight"
        //       // });

        //       // Process authentication
        //       await lastValueFrom(
        //         this.ssoService.socialAuthorization({
        //           code: authData.code,
        //           state: authData.state,
        //           session_state: authData.session_state
        //         })
        //       ).then((res) => {
        //         if (res.success) {
        //           resolve(res.data);
        //         } else {
        //           resolve(null);
        //         }
        //       });
        //       delete (window as any).WINDOW_AUTH_DATA;
        //     } else {
        //       reject("Nothing to return data");
        //     }
        //   }
        // }, 500);
      } else {
        reject(generateRedirection);
      }
    });
  }
}

interface WindowAuthData {
  code: string;
  state: string;
  session_state: string;
}
