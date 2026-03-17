import { NgModule } from "@angular/core";
import { ProofOfPaymentRoutingModule } from "./proof-of-payment-routing.module";
import { LayoutComponent } from "./layout/layout.component";
import { SocialLoginService } from "@isms-core/services/src/sso/social-login.service";

@NgModule({
  declarations: [LayoutComponent],
  imports: [ProofOfPaymentRoutingModule],
  providers: [SocialLoginService],
})
export class ProofOfPaymentModule {}
