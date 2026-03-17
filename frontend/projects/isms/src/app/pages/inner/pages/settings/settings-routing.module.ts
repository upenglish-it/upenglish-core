import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { LayoutComponent } from "./layout/layout.component";
import { RouterUtils } from "@isms-core/constants";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        redirectTo: RouterUtils.inner.settings.myAccount.root,
        pathMatch: "full",
      },

      {
        path: RouterUtils.inner.settings.myAccount.root,
        loadChildren: async () => (await import("./pages/my-account/my-account.module")).MyAccountModule,
      },

      {
        path: RouterUtils.inner.settings.general.root,
        loadChildren: async () => (await import("./pages/general/general.module")).GeneralModule,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SettingsRoutingModule {}
