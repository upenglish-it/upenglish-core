import { Component, Input, OnInit } from "@angular/core";
import { FormArray, FormGroup } from "@angular/forms";
import { Animations } from "@isms-core/constants";

@Component({
  selector: "section-content",
  templateUrl: "./section-content.component.html",
  animations: [Animations.down],
})
export class SectionContentComponent implements OnInit {
  @Input("form-array") formArray: FormArray;

  public ngOnInit(): void {}

  public createProductFormGroup(index: number): FormGroup {
    return this.formArray.at(index) as FormGroup;
  }
}
