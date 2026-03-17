import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { AppComponent } from "./app.component";
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { NgxTinymceModule } from "ngx-tinymce";

import { NZ_ICONS } from "ng-zorro-antd/icon";
import { IconDefinition } from "@ant-design/icons-angular";
import * as AllIcons from "@ant-design/icons-angular/icons";
import { NZ_CONFIG, NzConfig } from "ng-zorro-antd/core/config";
import { NZ_I18N, en_US } from "ng-zorro-antd/i18n";
import { StoreModule } from "@ngrx/store";
import { StoreDevtoolsModule } from "@ngrx/store-devtools";
import { WebShellModule } from "@isms-shell/web-shell.module";
import { RTinyMCEOptions } from "@isms-core/constants";
import { NGRX_REDUCERS } from "@isms-core/ngrx";
import { JwtInterceptor } from "@isms-core/interceptors";
import { TranslocoRootModule } from "./transloco-root.module";

const antDesignIcons = AllIcons as {
  [key: string]: IconDefinition;
};
const icons: IconDefinition[] = Object.keys(antDesignIcons).map((key) => antDesignIcons[key]);
const ngZorroConfig: NzConfig = {
  notification: { nzPauseOnHover: true, nzDuration: 5000, nzMaxStack: 3, nzPlacement: "topRight" },
};

@NgModule({
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    WebShellModule,
    NgxTinymceModule.forRoot(RTinyMCEOptions),
    StoreModule.forRoot(NGRX_REDUCERS, {
      runtimeChecks: {
        strictStateImmutability: false,
        strictActionImmutability: false,
      },
    }),
    StoreDevtoolsModule.instrument({ maxAge: 25 }),
    TranslocoRootModule,
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
    { provide: NZ_CONFIG, useValue: ngZorroConfig },
    { provide: NZ_I18N, useValue: en_US },
    { provide: NZ_ICONS, useValue: icons },
    provideHttpClient(withInterceptorsFromDi()),
  ],
})
export class AppModule {}
