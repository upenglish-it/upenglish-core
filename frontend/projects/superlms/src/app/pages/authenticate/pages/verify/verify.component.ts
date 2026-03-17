import { Component, inject, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";

@Component({
  selector: "slms-verify",
  imports: [],
  templateUrl: "./verify.component.html",
  styleUrl: "./verify.component.less",
})
export class VerifyComponent implements OnInit {
  //--- Injectables
  public router: Router = inject(Router);
  public activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  private apiService: ApiService = inject(ApiService);

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    const role = this.activatedRoute.parent.snapshot.queryParamMap?.get("role");
    let url: string | null = null;

    if (role === "admin") {
      url = "/a";
    }
    if (role === "teacher") {
      url = "/t";
    }
    if (role === "student") {
      url = "/s";
    }

    const emailAddress = this.activatedRoute.parent.snapshot.queryParamMap?.get("email");
    this.apiService.endPointsC.auth.get.generateToken(this.apiService, { emailAddress: emailAddress }).then((res) => {
      console.log(res);
      if (res.success) {
        localStorage.setItem("authorization", res.data.authorizationToken);
        this.router.navigateByUrl(url, { replaceUrl: true });
        // location.reload();
      }
    });
  }
}
