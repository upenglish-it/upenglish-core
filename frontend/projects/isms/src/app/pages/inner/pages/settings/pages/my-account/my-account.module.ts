import { CommonModule, NgClass, NgFor, NgIf } from "@angular/common";
import { NgModule } from "@angular/core";
import { AccountRoutingModule } from "./my-account-routing.module";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { LayoutComponent } from "./layout/layout.component";
import { ProfilePage } from "./pages/profile/profile.page";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzButtonModule } from "ng-zorro-antd/button";
import { LanguagePage } from "./pages/language/language.page";
import { NotificationPage } from "./pages/notification/notification.page";
import { LockScreenPage } from "./pages/lock-screen/lock-screen.page";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { IntegrationPage } from "./pages/integration/integration.page";

@NgModule({
  declarations: [
    LayoutComponent,

    /* Pages */
    NotificationPage,
    LanguagePage,
    LockScreenPage,
    IntegrationPage,
  ],
  imports: [NgClass, NgIf, NgFor, AccountRoutingModule, FormsModule, ReactiveFormsModule, NzInputModule, NzSelectModule, NzButtonModule, NzSwitchModule],
})
export class MyAccountModule {}
