import { Component, OnInit } from "@angular/core";
import { Event, NavigationEnd, Router } from "@angular/router";
import { ISegmentSelector } from "@isms-core/interfaces";

@Component({
  selector: "layout",
  templateUrl: "./layout.component.html",
  standalone: false,
})
export class LayoutComponent implements OnInit {
  // public selectedSegmentIndex = 0;
  public segmentOptions: Array<ISegmentSelector> = [
    {
      label: "My Profile",
      icon: "ph-duotone ph-user-circle",
      route: "/i/account/settings/profile",
      disable: false,
    },
    {
      label: "Notification",
      icon: "ph-duotone ph-bell",
      route: "/i/account/settings/notification",
      disable: false,
    },
    {
      label: "My Availability",
      icon: "ph-duotone ph-calendar-check",
      route: "/i/account/settings/availability",
      disable: false,
    },
  ];

  constructor(private readonly router: Router) {
    // this.router.events.subscribe((event: Event) => {
    //   if (event instanceof NavigationEnd) {
    //     const currentRoute = event.url;
    //     const currentRouteIndex = this.segmentOptions.findIndex((so) => so.route === currentRoute);
    //     if (currentRouteIndex !== -1) {
    //       this.selectedSegmentIndex = currentRouteIndex;
    //     }
    //   }
    // });
  }

  public ngOnInit(): void {}

  public onChangeSegmentSelector(index: number): void {
    // this.selectedSegmentIndex = index;
    const route = this.segmentOptions[index].route;
    this.router.navigateByUrl(route);
  }
}
