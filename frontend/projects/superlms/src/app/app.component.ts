import { Component, inject, OnInit } from "@angular/core";
import { ActivatedRoute, Router, RouterOutlet } from "@angular/router";
import { AccountService } from "./services/account/account.service";

@Component({
  selector: "slms-root",
  imports: [RouterOutlet],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.less"],
})
export class AppComponent implements OnInit {
  public viewState: "account-loading" | "account-loaded" = "account-loading";
  public accountService: AccountService = inject(AccountService);
  public router: Router = inject(Router);
  public activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  // emailAddress = this.activatedRoute.parent.snapshot.queryParamMap?.get("email");

  constructor() {
    //--- Admin Token
    // localStorage.setItem(
    //   "authorization",
    //   "QR1hTTm4Xs4WMDGvNPRlCCg0fUNlwOgPHsSre+KYau54ksqFcHUIJzaXisZp+2x7TkYEa4AEAAMcLBtcV3hedm6Mp8DR1RMOcNYru9sL+1rpfrDGlfopr6Vqe64JG2xLGHF0IjDqR2mCZbFU0U+WZIUPqSzPCDR7Pii8Oz0bEcQ90xeUELwRslX9GypZlWaxXn3afzjqBAmb5bL5UOl97A+TOJbPAQjY57TEcT/c8wxSFfIo7oi2TItwgJ49m/6yjVJdlyhdke9tgg8MEIlXLfXfjKxIBg6c4QOCejLkGWNrwYN89YPecKYf+r1H/rdNelJu4aOpxsdZsL8CSm/ZpzRsluDWoQOGlOaESmae3TF57/vJ5TrE5s1rVvylPSgoPkGvMCR8hT1oumS8srWitw1UXJ0x/Z59H4XidFDIQ1NViUaWCVYQgnwLNOdte79Om6T9P4OXpdNaU+BSpTvBDV8aeYn8v55Q73Xg3pxNEYKm+aTCyG+J/g0wbDtzaHSvATA04xzmWS3XaAlA6TQcudyMv7wEBJDcGBq0iVQe5LVTWb9Q1cwa10vL80f7+Qi3uaM7vk4kR1UQqwFY0eV+sUhAEeQWdUm98jHjUXJ+hQvF2KgYuvUirjvCPZAAghuMycE7852YjKYpUt8c9a6iMM/PUoTB1ofyc528LeOzrHJRQaHwhkl/3L1M0mONCwvfZaQy2bBjafRShGwmyXEPfDWRAmV4l0sM2DLQUSq0zOSYylwv+VfjzX+SB9NuRsLuc350h7EThK8ghr0LPUzvFHcrw5JQjBcH9kjtqrZ8c/wEtdJP31yzxxB5lNjAm/QXvbn3p4VL76J7hMoiyIiTWbE+YtVxRlKh225l+Tpeg2aTjeVfB0R6OT4ZAw6Ty+0gRWLk+HABWl1Ml8CA68HN/au9CGB0Tdb17iE4Ezh0/lVUPIq/CcmARn32JSBRMI3JXWQhGWCLdXrMJmtTpZ23/z0n5ExS2cLnsxeJihAxS9Fkt5KDaIz4KUDsoWLGHvUlFiyRJ2OSUIVi1x/hDE0822NkGwWpg6V0eEbOjj5Sv5waj3/Nw5IzOXCzX8HhpLVWkMJlY5cnpoOggbcs5ZHtkzi0qNWpNFXJKH7wwrn9I2J0ayHiyeFJquzzAUlifiaujs8Nr1Qd7wZuNX6PX34plVWe0a9bltpEV6ToBeL70q5ZsVdMj9yj8KkwsELWFBA28vRnZ9daLZ5Ic606bI1qzX4o+Zvy7Yos6ZPVy9GzvQ6tEpwbTUhF96EG6N2xY2zNDZxv+RVyP9ByvF4UGex567fObhMghStLXxZGTeIgVWwMQYB9qY286hXQ66g8ZMYp268jksXthQ2NhwgGcBZVCn7rF0qn+Ak+ftNKh9BjRAbwZYuodd7Wdz21mWynQO3d7RqKS2qQHYqKg8SLA0CVfpK0+kQVLFAtDp/LHHFMX0xH+EsbsXcy+qCywmeiLNvAYXHIUM6/KSlpaZPIXdSJ9yTzb/0D+rem7tbbXKcTl8YiVjU7hUDYUmPCoutgt+cWrcjELhUJnwWCRwodOFyBPQ457fNCyrzo10YGgtt+K105fpj1mJGwnptyVRPUhjoWxJze7JaG5zhM7jTZJRmYnCxta6ZdAEikah/1U7lih++HpuszN89lMBqsXCdRxEkPQkjOj/K83tv4/yeXTuy6+UskgR/lrN+NeaIrMahYgCWObFcC+mBif6c71P78BNJ733reYWFZ4GJsZ5j/7qFUaKSNPDZ1VoT+Zmci1/xhfMGxgk3TeEkjPxXQCGxb/uV2"
    // );
  }

  ngOnInit(): void {
    if (window.location.pathname.includes("/authenticate/verify")) {
      this.viewState = "account-loaded";
    } else {
      this.accountService.loadAccount().then((res) => {
        this.viewState = res ? "account-loaded" : "account-loading";
      });
    }
  }
}
