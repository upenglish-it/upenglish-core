import { Component } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { AccountStore } from "@isms-core/ngrx";
import { LockScreenService, SSOService } from "@isms-core/services";
import { lastValueFrom } from "rxjs";

@Component({
  templateUrl: "./lock-screen.page.html",
  standalone: false,
})
export class LockScreenPage {
  public lockScreenFormGroup: FormGroup;

  constructor(
    private readonly lockScreenService: LockScreenService,
    private readonly ssoService: SSOService,
    private readonly accountStore: AccountStore
  ) {}

  public ngOnInit(): void {
    this.initializeFormGroup();
  }

  private initializeFormGroup(): void {
    this.lockScreenFormGroup = new FormGroup({
      enable: new FormControl(false),
      code: new FormControl(null),
      idleDuration: new FormControl(null),
    });

    lastValueFrom(this.ssoService.account()).then((res) => {
      this.lockScreenFormGroup.setValue(res.data.account.lockScreen, { emitEvent: false });
    });
  }

  public onSubmit(): void {
    lastValueFrom(this.lockScreenService.update(this.lockScreenFormGroup.value)).then((res) => {
      if (res.success) {
        this.accountStore.update(res.data.account);
        this.lockScreenFormGroup.reset(this.lockScreenFormGroup.value);
      }
    });
  }
}
