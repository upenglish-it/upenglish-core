import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { LayoutComponent } from "./layout/layout.component";
import { ProfilePage } from "./pages/profile/profile.page";
import { RouterUtils } from "@isms-core/constants";
import { NotificationPage } from "./pages/notification/notification.page";
import { LockScreenPage } from "./pages/lock-screen/lock-screen.page";
import { LanguagePage } from "./pages/language/language.page";
import { LeavesPage } from "./pages/leaves/leaves.page";
import { IntegrationPage } from "./pages/integration/integration.page";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        redirectTo: RouterUtils.inner.settings.myAccount.profile,
        pathMatch: "full",
      },
      {
        path: RouterUtils.inner.settings.myAccount.profile,
        component: ProfilePage,
        data: {
          title: "Profile",
        },
      },
      {
        path: RouterUtils.inner.settings.myAccount.notification,
        component: NotificationPage,
        data: {
          title: "Notification",
        },
      },
      {
        path: RouterUtils.inner.settings.myAccount.lockScreen,
        component: LockScreenPage,
        data: {
          title: "Lock Screen",
        },
      },
      {
        path: RouterUtils.inner.settings.myAccount.language,
        component: LanguagePage,
        data: {
          title: "Language",
        },
      },
      {
        path: RouterUtils.inner.settings.myAccount.leaves,
        component: LeavesPage,
        data: {
          title: "Leaves",
        },
      },
      {
        path: RouterUtils.inner.settings.myAccount.integration,
        component: IntegrationPage,
        data: {
          title: "Integration",
        },
      },
      {
        path: RouterUtils.inner.settings.myAccount.payslip,
        component: LeavesPage,
        data: {
          title: "Payslip",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AccountRoutingModule {}
