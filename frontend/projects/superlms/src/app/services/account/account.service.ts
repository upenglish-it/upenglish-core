import { inject, Injectable, OnInit } from "@angular/core";
import { IAccount, IBranch } from "@isms-core/interfaces";
import { IProperties } from "@isms-core/interfaces/src/properties/properties.interface";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";

@Injectable({
  providedIn: "root",
})
export class AccountService {
  //--- Injectables
  private apiService: ApiService = inject(ApiService);

  public account: IAccount | null = null;
  public selectedBranch: IBranch = null;

  constructor() {}

  public async loadAccount(): Promise<boolean> {
    return new Promise((resolve) => {
      this.apiService.endPointsC.account.get.account(this.apiService).then((res) => {
        if (res.success) {
          this.account = res.data.account;
          this.selectedBranch = res.data.properties.at(0).propertiesBranches.find((prop) => prop._id === this.account.selectedBranch) || null;
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  // /**----------------------------------------------------------------
  //  * @name          account
  //  * @description   Get account data
  //  * @returns       {IAccount | null}
  //  */
  // public get account(): IAccount | null {
  //   return this.accountData;
  // }

  // /**----------------------------------------------------------------
  //  * @name          set user
  //  * @description   Set account data
  //  */
  // set account(value: IAccount | null) {
  //   this.accountData = value;
  // }
}
