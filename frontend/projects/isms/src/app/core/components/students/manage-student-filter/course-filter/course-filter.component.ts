import { NgFor, NgIf } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Animations } from "@isms-core/constants";
// import { GroupService, SubGroupService } from "@isms-core/services";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzNotificationService } from "ng-zorro-antd/notification";

@Component({
  selector: "isms-course-filter",
  templateUrl: "./course-filter.component.html",
  animations: [Animations.default],
  imports: [NgIf, NgFor, ReactiveFormsModule, NzModalModule, NzInputModule, NzDropDownModule],
})
export class CourseFilterComponent implements OnInit {
  @Input("form-group") public groupFormGroup: FormGroup;
  public showDrawer: boolean;
  public loadingCreateGroupButton = false;

  // constructor(private readonly groupService: GroupService, private readonly subGroupService: SubGroupService, private readonly nzNotificationService: NzNotificationService) {}

  public ngOnInit(): void {}

  public toggle(): void {
    this.showDrawer = !this.showDrawer;
  }

  public toFormGroup(form: AbstractControl): FormGroup {
    return form as FormGroup;
  }

  public removeSubGroup(index: number): void {
    this.subGroupFormArray.removeAt(index);
  }

  public addSubGroup(): void {
    this.subGroupFormArray.push(
      new FormGroup({
        _id: new FormControl(null),
        name: new FormControl(null, [Validators.required]),
      })
    );
  }

  public saveGroup(): void {
    console.log("this", this.groupFormGroup.value);
    // if (this.groupFormGroup.valid) {
    //   this.loadingCreateGroupButton = true;
    //   this.groupService
    //     .create({ name: this.groupFormGroup.value.name })
    //     .toPromise()
    //     .then((res) => {
    //       this.loadingCreateGroupButton = false;
    //       if (res.success) {
    //         this.nzNotificationService.success("Create Group", res.message, { nzPlacement: "bottomRight" });
    //         this.groupFormGroup.get("_id").setValue(res.data._id);
    //         this.addSubGroup();
    //       } else {
    //         this.nzNotificationService.warning("Create Group", res.message, { nzPlacement: "bottomRight" });
    //       }
    //     });
    // }
  }

  public saveSubGroup(index: number): void {
    const subGroupForm = this.subGroupFormArray.controls[index];
    console.log(subGroupForm);

    // if (subGroupForm.valid) {
    //   // this.loadingCreateGroupButton = true;
    //   this.subGroupService
    //     .create({ name: subGroupForm.value.name }, this.groupFormGroup.value._id)
    //     .toPromise()
    //     .then((res) => {
    //       // this.loadingCreateGroupButton = false;
    //       if (res.success) {
    //         this.subGroupFormArray.controls[index].get("_id").setValue(res.data._id);
    //         this.nzNotificationService.success("Create Group", res.message, { nzPlacement: "bottomRight" });
    //       } else {
    //         this.nzNotificationService.warning("Create Group", res.message, { nzPlacement: "bottomRight" });
    //       }
    //     });
    // }
  }

  public updateSubGroup(index: number): void {
    const subGroupForm = this.subGroupFormArray.controls[index];
    console.log(subGroupForm);

    // if (subGroupForm.valid) {
    //   // this.loadingCreateGroupButton = true;
    //   this.subGroupService
    //     .create({ name: subGroupForm.value.name }, this.groupFormGroup.value._id)
    //     .toPromise()
    //     .then((res) => {
    //       // this.loadingCreateGroupButton = false;
    //       if (res.success) {
    //         this.subGroupFormArray.controls[index].get("_id").setValue(res.data._id);
    //         this.nzNotificationService.success("Create Group", res.message, { nzPlacement: "bottomRight" });
    //         // this.addSubGroup();
    //       } else {
    //         this.nzNotificationService.warning("Create Group", res.message, { nzPlacement: "bottomRight" });
    //       }
    //     });
    // }
  }

  public get subGroupFormArray(): FormArray {
    return this.groupFormGroup.get("subGroup") as FormArray;
  }
}
