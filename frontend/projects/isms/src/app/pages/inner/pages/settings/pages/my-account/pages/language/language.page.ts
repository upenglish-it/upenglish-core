import { Component, ViewEncapsulation, inject } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { AccountStore } from "@isms-core/ngrx";
import { LanguageService, SSOService } from "@isms-core/services";
import { TranslocoService } from "@jsverse/transloco";
import { lastValueFrom } from "rxjs";

@Component({
  templateUrl: "./language.page.html",
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      .gt_switcher_wrapper {
        display: block !important;
      }
    `,
  ],
  standalone: false,
})
export class LanguagePage {
  private translocoService = inject(TranslocoService);
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

    this.languageFormGroup.get("language").valueChanges.subscribe((value) => {
      // this.translocoService
      //   .load("vi")
      //   .pipe(take(1))
      //   .subscribe(() => {
      this.translocoService.setActiveLang(value);
      //     console.log(
      //       ">>",

      //       this.service.getActiveLang()
      //     );
      //   });
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
