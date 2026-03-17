// import { CommonModule } from "@angular/common";
// import { HttpClientModule, HTTP_INTERCEPTORS } from "@angular/common/http";
// import { NgModule } from "@angular/core";
// import { JwtInterceptor } from "./interceptors";
// import { StoreModule } from "@ngrx/store";
// import { NGRX_REDUCERS } from "./ngrx";
// import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
// import { StoreDevtoolsModule } from "@ngrx/store-devtools";
// import { WebShellModule } from "@isms-shell/web-shell.module";

// @NgModule({
//   imports: [
//     CommonModule,
//     HttpClientModule,
//     BrowserAnimationsModule,
//     StoreModule.forRoot(NGRX_REDUCERS, {
//       runtimeChecks: {
//         strictStateImmutability: false,
//         strictActionImmutability: false
//       }
//     }),
//     StoreDevtoolsModule.instrument({ maxAge: 25 }),
//     WebShellModule
//   ],
//   providers: [{ provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true }]
// })
// export class CoreModule {}
