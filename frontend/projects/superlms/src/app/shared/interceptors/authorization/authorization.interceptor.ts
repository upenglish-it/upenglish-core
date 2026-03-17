/**
 * Authorization Interceptor
 *
 * @file          authorization.interceptor
 * @description   Intercepts all HTTP calls for error handling and header definitions
 * @author        John Mark Alicante
 * @since         2025 - 06 - 01
 */

//--- NG Modules
import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from "@angular/common/http";

export const AuthorizationInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authorization = localStorage.getItem("authorization");
  const headerReq = req.clone({
    setHeaders: {
      ...(authorization ? { authorization: authorization } : null),
    },
  });
  return next(headerReq);
};
