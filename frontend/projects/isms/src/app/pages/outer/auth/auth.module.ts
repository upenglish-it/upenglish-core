import { NgClass, NgIf } from "@angular/common";
import { NgModule } from "@angular/core";
import { AuthRoutingModule } from "./auth-routing.module";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { LayoutComponent } from "./layout/layout.component";
import { SignInPage } from "./pages/sign-in/sign-in.page";
import { NzButtonModule } from "ng-zorro-antd/button";
import { SocialLoginService } from "@isms-core/services/src/sso/social-login.service";

@NgModule({
  declarations: [LayoutComponent, SignInPage],
  imports: [NgClass, NgIf, AuthRoutingModule, FormsModule, ReactiveFormsModule, NzButtonModule],
  providers: [SocialLoginService],
})
export class AuthModule {}
