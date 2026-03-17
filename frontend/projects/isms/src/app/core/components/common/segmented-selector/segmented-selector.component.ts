import { NgClass, NgFor, NgIf } from "@angular/common";
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { Event, NavigationEnd, Router } from "@angular/router";
import { ISegmentSelector } from "@isms-core/interfaces";

@Component({
  selector: "isms-segmented-selector",
  templateUrl: "./segmented-selector.component.html",
  imports: [NgClass, NgIf, NgFor],
})
export class SegmentedSelectorComponent implements OnInit {
  @Output("on-changed")
  public onChanged: EventEmitter<number> = new EventEmitter<number>();
  @Input("current-index") currentIndex: number = 0;
  @Input("options") options: Array<ISegmentSelector> = [];

  constructor(private readonly router: Router) {}

  public ngOnInit(): void {
    this.setActiveTab(this.router.url);
    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationEnd) {
        const currentRoute = event.url;
        this.setActiveTab(currentRoute);
      }
    });
  }

  private setActiveTab(currentRoute: string): void {
    const currentRouteIndex = this.options.findIndex((so) => so?.route === currentRoute);
    if (currentRouteIndex !== -1) {
      this.currentIndex = currentRouteIndex;
    }
  }
}
