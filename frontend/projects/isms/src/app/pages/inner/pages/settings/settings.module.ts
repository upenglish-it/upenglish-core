import { NgFor, NgIf } from "@angular/common";
import { NgModule } from "@angular/core";
import { SettingsRoutingModule } from "./settings-routing.module";
import { LayoutComponent } from "./layout/layout.component";
import { TranslocoModule } from "@jsverse/transloco";
import { TranslocoRootModule } from "projects/isms/src/app/transloco-root.module";

@NgModule({
  declarations: [LayoutComponent],
  imports: [NgFor, NgIf, SettingsRoutingModule, TranslocoModule],
})
export class SettingsModule {}
