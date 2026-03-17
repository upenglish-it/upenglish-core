import { Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { AccountService } from "@superlms/services/account/account.service";
import { NzButtonModule } from "ng-zorro-antd/button";

@Component({
  selector: "slms-taking-task",
  imports: [
    //--- NG Zorro
    NzButtonModule,
  ],
  templateUrl: "./taking-task.component.html",
  styleUrl: "./taking-task.component.less",
})
export class TakingTaskComponent {
  //--- Injectables
  public router: Router = inject(Router);
  public accountService: AccountService = inject(AccountService);
  public activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  //--- Public
  public accountFields: any[] = [];

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.accountFields = [
      { id: 1, name: "Full Name", value: this.accountService.account.firstName + " " + this.accountService.account.lastName },
      { id: 1, name: "Email Address", value: this.accountService.account.emailAddresses.length > 0 ? this.accountService.account.emailAddresses.at(0) : "---" },
      {
        id: 2,
        name: "Phone",
        value:
          this.accountService.account.contactNumbers.length > 0
            ? this.accountService.account.contactNumbers.at(0)?.countryCallingCode + "" + this.accountService.account.contactNumbers.at(0)?.number
            : "---",
      },
      // { id: 3, name: "Email", value: this.accountService.account.emailAddresses.length > 0 ? this.accountService.account.emailAddresses.at(0) : "---" },
      { id: 4, name: "Address", value: this.accountService.account.address.city || "---" },
      { id: 5, name: "Date of Birth", value: this.accountService.account.birthDate || "---" },
      { id: 8, name: "Status", value: this.accountService.account.active ? "Active" : "Inactive" },
    ];
  }

  public proceed(): void {
    this.router.navigate(["/task", this.activatedRoute.parent.snapshot.paramMap.get("taskId"), "builder"], { queryParams: this.activatedRoute.snapshot.queryParams });
  }
}
