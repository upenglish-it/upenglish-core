import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { StoreModule } from "@ngrx/store";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { StoreDevtoolsModule } from "@ngrx/store-devtools";

import { HTTP_INTERCEPTORS } from "@angular/common/http";
import { InnerAuthGuard, OuterAuthGuard } from "@isms-core/guards";
import { RouterUtils } from "@isms-core/constants";
import { NGRX_REDUCERS } from "@isms-core/ngrx";
import { JwtInterceptor, LoaderInterceptor } from "@isms-core/interceptors";
import { LoaderService } from "@isms-core/services";

const AppRoutes: Routes = [
  {
    path: RouterUtils.auth.root,
    loadChildren: async () => (await import("../pages/outer/auth/auth.module")).AuthModule,
    canActivate: [OuterAuthGuard],
  },
  {
    path: RouterUtils.socialLoginLanding.root,
    loadChildren: async () => (await import("../pages/outer/social-login-landing/social-login-landing.module")).SocialLoginLandingModule,
  },
  {
    path: RouterUtils.integrationLanding.root,
    loadChildren: async () => (await import("../pages/outer/integration-landing/integration-landing.module")).IntegrationLandingModule,
  },
  {
    path: RouterUtils.proofOfPayment.root,
    loadChildren: async () => (await import("../pages/outer/proof-of-payment/proof-of-payment.module")).ProofOfPaymentModule,
  },
  {
    path: RouterUtils.tasks.root,
    loadChildren: async () => (await import("../pages/outer/tasks/tasks.module")).TaskModule,
  },
  {
    path: RouterUtils.inner.root,
    loadChildren: async () => (await import("../pages/inner/inner.module")).InnerModule,
    canActivate: [InnerAuthGuard],
  },
  {
    path: "**",
    redirectTo: RouterUtils.auth.root,
    pathMatch: "full",
    // loadChildren: async () => (await import("../pages/not-found/not-found.module")).NotFoundModule,
    // component: NotFoundPage
  },
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forRoot(AppRoutes),
    BrowserAnimationsModule,
    StoreModule.forRoot(NGRX_REDUCERS, {
      runtimeChecks: {
        strictStateImmutability: false,
        strictActionImmutability: false,
      },
    }),
    StoreDevtoolsModule.instrument({ maxAge: 25 }),
  ],
  exports: [RouterModule],
  providers: [LoaderService, { provide: HTTP_INTERCEPTORS, useClass: LoaderInterceptor, multi: true }, { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true }],
})
export class WebShellModule {}
