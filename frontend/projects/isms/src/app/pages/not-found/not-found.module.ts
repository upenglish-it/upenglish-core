import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { NzResultModule } from "ng-zorro-antd/result";
import { NotFoundPage } from "./not-found.page";
import { RouterUtils } from "@isms-core/constants";

@NgModule({
  declarations: [NotFoundPage],
  imports: [
    CommonModule,
    RouterModule.forChild([
      {
        path: RouterUtils.errorResponse.notFound,
        component: NotFoundPage,
      },
    ]),
    NzResultModule,
  ],
})
export class NotFoundModule {}
