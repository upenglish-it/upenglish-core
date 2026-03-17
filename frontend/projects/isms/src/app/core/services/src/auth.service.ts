import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { isEmpty } from "lodash";
import { lastValueFrom } from "rxjs";
import { LocalStorageService } from "./local-storage.service";
import { SSOService } from "./sso";
import { SocketIOService } from "./socketio/socketio.service";
import { AccountStore } from "@isms-core/ngrx";
import { LocalStorageKeys, RouterUtils } from "@isms-core/constants";
import { IAccount } from "@isms-core/interfaces";
import { NzNotificationService } from "ng-zorro-antd/notification";

@Injectable({
  providedIn: "root",
})
export class AuthService {
  constructor(
    private readonly localStorageService: LocalStorageService,
    private readonly router: Router,
    private readonly ssoService: SSOService,
    private readonly account: AccountStore,
    private readonly socketIOService: SocketIOService
  ) {}

  public async isLoggedIn(): Promise<boolean> {
    const authorizationToken = this.localStorageService.get(LocalStorageKeys.AUTHORIZATION);

    if (isEmpty(authorizationToken)) {
      return false;
    }

    const accountResponse = await lastValueFrom(this.ssoService.account());

    if (accountResponse.success) {
      /* Connect to  socket.io */
      this.socketIOService.connect();

      /* save the account info to redux since it was logged in */

      const account: IAccount = accountResponse.data.account;

      /* if account is not active */
      if (!account.active) {
        return false;
      }

      this.account.update(account);
    }

    return accountResponse.success;
  }

  public redirectToInner(): void {
    this.router.navigateByUrl(RouterUtils.inner.root, { replaceUrl: true });
  }

  public logOut(): void {
    this.localStorageService.remove(LocalStorageKeys.AUTHORIZATION);
    this.router.navigateByUrl(`${RouterUtils.auth.root}/${RouterUtils.auth.signIn}`, { replaceUrl: true });
  }
}
