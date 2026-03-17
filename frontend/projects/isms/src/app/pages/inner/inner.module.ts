import { NgClass, NgFor, NgIf } from "@angular/common";
import { NgModule } from "@angular/core";
import { InnerRoutingModule } from "./inner-routing.module";
import { LayoutComponent } from "./layout/layout.component";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzProgressModule } from "ng-zorro-antd/progress";
import { NzInputModule } from "ng-zorro-antd/input";
import { NgIdleKeepaliveModule } from "@ng-idle/keepalive";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { ReactiveFormsModule } from "@angular/forms";
import { NotificationDrawerComponent } from "@isms-core/components/common/notification-drawer/notification-drawer.component";
import { environment } from "@isms-env/environment";

import { initializeApp } from "firebase/app";
import { SystemNotificationActivationModalComponent } from "@isms-core/components/common/system-notification-activation-modal/system-notification-activation-modal.component";
import { ProfilePhotoDirective } from "@isms-core/directives";
initializeApp(environment.firebase);

@NgModule({
  declarations: [LayoutComponent],
  imports: [
    NgClass,
    NgFor,
    NgIf,
    ReactiveFormsModule,
    InnerRoutingModule,
    ProfilePhotoDirective,
    NgIdleKeepaliveModule.forRoot(), // use NgIdleModule.forRoot() if not using keepalive
    NzToolTipModule,
    NzProgressModule,

    NzInputModule,
    NzButtonModule,
    NzIconModule,
    NotificationDrawerComponent,
    SystemNotificationActivationModalComponent,
  ],
})
export class InnerModule {}
