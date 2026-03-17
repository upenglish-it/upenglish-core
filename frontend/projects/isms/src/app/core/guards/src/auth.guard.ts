import { inject } from "@angular/core";
import { AuthService } from "@isms-core/services";

export const OuterAuthGuard = async () => {
  const authService = inject(AuthService);
  const isLoggedIn = await authService.isLoggedIn();

  /* stay since token is missing/invalid */
  if (!isLoggedIn) {
    return true;
  }

  /* redirect to inner page since token valid */
  return authService.redirectToInner();
};

export const InnerAuthGuard = async () => {
  const authService = inject(AuthService);
  const isLoggedIn = await authService.isLoggedIn();

  /* stay since token valid */
  if (isLoggedIn) {
    return true;
  }

  /* redirect to the login page since token is missing/invalid */
  return authService.logOut();
};
