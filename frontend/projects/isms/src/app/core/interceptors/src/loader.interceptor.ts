import { Injectable } from "@angular/core";
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { Observable } from "rxjs";
import { finalize } from "rxjs/operators";
import { LoaderService } from "@isms-core/services";

@Injectable()
export class LoaderInterceptor implements HttpInterceptor {
  private activeRequests: number = 0;

  constructor(private loaderService: LoaderService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (req.body && req.body.loader != null) {
      if ((req.body.loader as boolean) === false) {
        return next.handle(req);
      }
    }

    this.loaderService.show();

    this.activeRequests++;

    if (this.activeRequests === 0) {
      this.loaderService.hide();
    }

    return next.handle(req).pipe(
      finalize(() => {
        this.stopLoader();
      })
    );
  }

  private stopLoader(): void {
    this.activeRequests--;
    if (this.activeRequests === 0) {
      this.loaderService.hide();
    }
  }
}
