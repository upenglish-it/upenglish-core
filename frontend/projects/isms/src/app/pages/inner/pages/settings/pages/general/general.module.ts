import { NgModule } from "@angular/core";
import { GeneralRoutingModule } from "./general-routing.module";
import { LayoutComponent } from "./layout/layout.component";
import { BranchesPage } from "./pages/branches/branches.page";
import { NgClass, NgFor, NgIf } from "@angular/common";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { ManageBranchModalComponent } from "@isms-core/components/settings/general/manage-branch-modal/manage-branch-modal.component";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";

@NgModule({
  declarations: [
    LayoutComponent,

    /* Pages */
    BranchesPage,
  ],
  imports: [
    NgClass,
    NgIf,
    NgFor,
    GeneralRoutingModule,
    ManageBranchModalComponent,
    NzDropDownModule,
    NzButtonModule,
    NzIconModule,
    NzToolTipModule,
    NzPopconfirmModule,
    ProfilePhotoDirective,
  ],
})
export class GeneralModule {}
