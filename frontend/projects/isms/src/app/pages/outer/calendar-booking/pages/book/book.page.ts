import { Component } from "@angular/core";
import { Animations } from "@isms-core/constants";
import { DateTime } from "luxon";

@Component({
  templateUrl: "./book.page.html",
  animations: [Animations.down],
})
export class BookPage {
  public calendarDate = new Date();
  public color: "green";
  constructor() {}

  public ngOnInit(): void {}

  public manageCalendarMonth(type: "back" | "next"): void {
    if (type === "back") {
      this.calendarDate = DateTime.fromJSDate(this.calendarDate).plus({ months: 1 }).toJSDate();
    }
    if (type === "next") {
      this.calendarDate = DateTime.fromJSDate(this.calendarDate).minus({ months: 1 }).toJSDate();
    }
  }
}
