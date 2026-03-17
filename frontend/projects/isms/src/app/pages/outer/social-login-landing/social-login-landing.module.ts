import { JsonPipe, NgClass, NgIf } from "@angular/common";
import { NgModule } from "@angular/core";
import { SocialLoginLandingRoutingModule } from "./social-login-landing-routing.module";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { LayoutComponent } from "./layout/layout.component";
import { NzButtonModule } from "ng-zorro-antd/button";
import { SocialLoginService } from "@isms-core/services/src/sso/social-login.service";
import { SocialLoginLandingPage } from "./pages/social-login-landing/social-login-landing.page";

@NgModule({
  declarations: [LayoutComponent, SocialLoginLandingPage],
  imports: [NgClass, NgIf, JsonPipe, SocialLoginLandingRoutingModule, FormsModule, ReactiveFormsModule, NzButtonModule],
  providers: [SocialLoginService],
})
export class SocialLoginLandingModule {}
