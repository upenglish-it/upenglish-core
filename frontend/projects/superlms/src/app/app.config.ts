//--- NG Modules
import { provideRouter } from "@angular/router";
import { ApplicationConfig } from "@angular/core";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { provideHttpClient, withFetch, withInterceptors } from "@angular/common/http";

//--- PrimeNG
import Aura from "@primeng/themes/aura";
import { definePreset } from "@primeng/themes";
import { providePrimeNG } from "primeng/config";

import { routes } from "./app.routes";
import { AuthorizationInterceptor } from "./shared/interceptors/authorization/authorization.interceptor";
//--- NG Zorro
import { en_US, provideNzI18n } from "ng-zorro-antd/i18n";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    provideAnimationsAsync(),

    provideNzI18n(en_US),

    provideHttpClient(withFetch(), withInterceptors([AuthorizationInterceptor])),

    //--- PrimeNG
    providePrimeNG({
      theme: {
        preset: definePreset(Aura, {
          semantic: {
            primary: {
              50: "#eff2fe",
              100: "#e2e9fd",
              200: "#cad6fb",
              300: "#aab9f7",
              400: "#8894f1",
              500: "#636ae8",
              600: "#534fdc",
              700: "#4640c2",
              800: "#3a369d",
              900: "#33337c",
              950: "#1f1e48",
            },
          },
        }),
        options: {
          prefix: "slms",
          darkModeSelector: "light",
        },
      },
    }),
  ],
};
