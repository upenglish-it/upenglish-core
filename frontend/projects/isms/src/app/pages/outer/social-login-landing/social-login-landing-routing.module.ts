import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { LayoutComponent } from "./layout/layout.component";
import { RouterUtils } from "@isms-core/constants";
import { SocialLoginLandingPage } from "./pages/social-login-landing/social-login-landing.page";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        component: SocialLoginLandingPage,
        data: {
          title: "Social Login Landing",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SocialLoginLandingRoutingModule {}
