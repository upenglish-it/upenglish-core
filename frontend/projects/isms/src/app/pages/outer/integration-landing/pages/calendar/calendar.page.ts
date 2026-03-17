import { AfterViewChecked, AfterViewInit, ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Animations } from "@isms-core/constants";

@Component({
  templateUrl: "./calendar.page.html",
  animations: [Animations.down],
  standalone: false,
})
export class CalendarPage implements OnInit, AfterViewInit, AfterViewChecked {
  public showCheckedMarkIcon: boolean = false;
  constructor(
    private activatedRoute: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    console.log("this.activatedRoute.snapshot.queryParams", this.activatedRoute.snapshot.queryParams);
  }
  public ngAfterViewInit(): void {
    this.showCheckedMarkIcon = true;
    setTimeout(() => {
      opener.window.WINDOW_AUTH_DATA = this.activatedRoute.snapshot.queryParams;
      self.close();
    }, 2500);
    this.cdr.detectChanges();
  }

  public ngAfterViewChecked(): void {}
}
