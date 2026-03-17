import { Component } from "@angular/core";
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ProfilePhotoUploadSelectorComponent } from "@isms-core/components/common/profile-photo-upload-selector/profile-photo-upload-selector.component";
import { NGRXService, ProofOfPaymentService, SSOService } from "@isms-core/services";
import { NzInputModule } from "ng-zorro-antd/input";
import { Animations } from "@isms-core/constants";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { SubSink } from "subsink";

@Component({
  templateUrl: "./profile.page.html",
  animations: [Animations.down],
  imports: [ReactiveFormsModule, NzInputModule, ProfilePhotoUploadSelectorComponent],
})
export class ProfilePage {
  public profileFormGroup: FormGroup;
  private subSink: SubSink = new SubSink();

  constructor(
    private readonly ngrxService: NGRXService,
    private readonly ssoService: SSOService
  ) {}

  public ngOnInit(): void {
    this.initializeFormGroup();
  }

  private initializeFormGroup(): void {
    this.profileFormGroup = new FormGroup({
      firstName: new FormControl(null),
      lastName: new FormControl(null),
      profilePhoto: new FormControl(null),
    });

    this.subSink.add(
      this.ngrxService.account().subscribe((res) => {
        this.profileFormGroup.get("profilePhoto").setValue(res.profilePhoto);
        this.profileFormGroup.get("firstName").setValue(res.firstName);
        this.profileFormGroup.get("lastName").setValue(res.lastName);
      })
    );

    this.subSink.add(
      this.profileFormGroup.valueChanges.pipe(distinctUntilChanged(), debounceTime(100)).subscribe((value) => {
        lastValueFrom(this.ssoService.updateById(this.profileFormGroup.value)).then();
      })
    );
  }

  public onSubmit(): void {}

  public onUploadFile(event: any): void {
    console.log(event);
    this.profileFormGroup.get("profilePhoto").setValue(event.value);
  }
}
