import { NgClass, NgIf } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Animations } from "@isms-core/constants";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";

@Component({
  selector: "isms-section-container",
  templateUrl: "./section-container.component.html",
  animations: [Animations.default, Animations.down],
  imports: [NgClass, NgIf, ReactiveFormsModule, NzSwitchModule, NzToolTipModule],
})
export class SectionContainerComponent {
  @Input({ alias: "form-group", required: true }) public formGroup: FormGroup;
  @Input({ alias: "title", required: true }) public title: string;
  @Input({ alias: "sub-title", required: false }) public subTitle: string;
  @Input({ alias: "tooltip", required: false }) public tooltip: string;
  @Input({ alias: "active", required: false }) public active: boolean = false;
  @Input({ alias: "collapsible", required: false }) public collapsible: boolean = true;
  @Input({ alias: "show-indicator", required: false }) public showIndicator: boolean = false;

  public toggleCollapse(): void {
    const expand = this.formGroup.value.expand;
    this.formGroup.get("expand").setValue(!expand);
  }
}
