import { JsonPipe, NgClass, NgIf } from "@angular/common";
import { NgModule } from "@angular/core";
import { IntegrationLandingRoutingModule } from "./integration-landing-routing.module";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { LayoutComponent } from "./layout/layout.component";
import { NzButtonModule } from "ng-zorro-antd/button";
import { SocialLoginService } from "@isms-core/services/src/sso/social-login.service";
import { CalendarPage } from "./pages/calendar/calendar.page";

@NgModule({
  declarations: [LayoutComponent, CalendarPage],
  imports: [NgClass, NgIf, JsonPipe, IntegrationLandingRoutingModule, FormsModule, ReactiveFormsModule, NzButtonModule],
  providers: [SocialLoginService],
})
export class IntegrationLandingModule {}
