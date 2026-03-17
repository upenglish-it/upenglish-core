import { Component } from "@angular/core";
import { Animations } from "@isms-core/constants";
import { NgIf } from "@angular/common";
import { TaskListingComponent } from "@isms-core/components/tasks/task-listing/task-listing.component";

@Component({
  templateUrl: "./listing.page.html",
  animations: [Animations.down, Animations.default],
  imports: [NgIf, TaskListingComponent],
})
export class ListingPage {}
