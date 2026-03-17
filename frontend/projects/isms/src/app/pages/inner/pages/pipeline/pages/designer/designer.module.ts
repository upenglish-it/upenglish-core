import { NgFor, NgIf } from "@angular/common";
import { NgModule } from "@angular/core";
import { DesignerRoutingModule } from "./designer-routing.module";
import { LayoutComponent } from "./layout/layout.component";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { RouterModule } from "@angular/router";

@NgModule({
  declarations: [LayoutComponent],
  imports: [
    DesignerRoutingModule,
    // FormsModule,
    // NgStyle,
    NgIf,
    NgFor,
    RouterModule,
    // NgClass,
    // ReactiveFormsModule,
    // SegmentedSelectorComponent,
    // ChooseCandidateModalComponent,
    // CandidateActionSelectorComponent,
    // DragDropModule,
    // NzSelectModule,
    // NzInputModule,
    NzButtonModule,
    NzIconModule,
    // NzCheckboxModule,
    // NzDropDownModule,
    // NzEmptyModule,
    // NzMessageModule,
    // NzSegmentedModule,
    // TimeAgoPipe,
    // ProfilePhotoDirective
  ],
})
export class DesignerModule {}
