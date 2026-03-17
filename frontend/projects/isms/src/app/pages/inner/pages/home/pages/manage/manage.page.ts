import { Component } from "@angular/core";
import { Animations } from "@isms-core/constants";

@Component({
  templateUrl: "./manage.page.html",
  animations: [Animations.down],
  standalone: false,
})
export class DashboardManagePage {
  public ngOnInit(): void {}
}
