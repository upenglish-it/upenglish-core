import { Component } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { AccountStore } from "@isms-core/ngrx";
import { LanguageService, SSOService } from "@isms-core/services";
import { lastValueFrom } from "rxjs";

@Component({
  templateUrl: "./integration.page.html",
  standalone: false,
})
export class IntegrationPage {
  public languageFormGroup: FormGroup;
  constructor(
    private readonly languageService: LanguageService,
    private readonly ssoService: SSOService,
    private readonly accountStore: AccountStore
  ) {}

  public ngOnInit(): void {
    this.initializeFormGroup();
  }

  private initializeFormGroup(): void {
    this.languageFormGroup = new FormGroup({
      language: new FormControl(null),
    });

    lastValueFrom(this.ssoService.account()).then((res) => {
      this.languageFormGroup.get("language").setValue(res.data.account.language, { emitEvent: false });
    });
  }

  public onSubmit(): void {
    lastValueFrom(this.languageService.update(this.languageFormGroup.value)).then((res) => {
      if (res.success) {
        this.accountStore.update(res.data.account);
        this.languageFormGroup.reset(this.languageFormGroup.value);
      }
    });
  }
}
