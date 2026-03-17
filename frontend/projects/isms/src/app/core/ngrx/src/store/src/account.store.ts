/* eslint-disable no-unused-vars */
import { Injectable } from "@angular/core";
import { IAccount } from "@isms-core/interfaces";
import { UpdateAccount } from "../../actions/account.action";
import { NGRXService } from "@isms-core/services";

@Injectable({
  providedIn: "root",
})
export class AccountStore {
  public account: IAccount;

  constructor(private readonly ngrxService: NGRXService) {
    this.ngrxService.account().subscribe((a) => (this.account = a));
  }

  public get fullName(): string {
    return `${this.account.firstName} ${this.account.lastName}`;
  }

  public get emailAddress(): string {
    return this.account.emailAddresses[0];
  }

  public update(data: IAccount): void {
    this.ngrxService.accountStore.dispatch(new UpdateAccount(data));
  }
}
