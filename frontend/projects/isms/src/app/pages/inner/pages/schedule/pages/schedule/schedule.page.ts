import { AfterViewInit, Component, ElementRef, ViewChild } from "@angular/core";
import { Animations } from "@isms-core/constants";
import Calendar from "tui-calendar";
import { DateTime } from "luxon";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { FormsModule } from "@angular/forms";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NgFor } from "@angular/common";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";

@Component({
  templateUrl: "./schedule.page.html",
  animations: [Animations.down],
  standalone: true,
  imports: [NgFor, FormsModule, NzDatePickerModule, NzButtonModule, NzCheckboxModule],
})
export class SchedulePage implements AfterViewInit {
  public tuiCalendar: Calendar = null;
  public selectedData = DateTime.now().toJSDate();

  @ViewChild("calendar") calendarContainer: ElementRef;

  ngAfterViewInit() {
    this.tuiCalendar = new Calendar(this.calendarContainer.nativeElement, {
      usageStatistics: false,
      defaultView: "month", // day, week,  month
      month: {
        visibleWeeksCount: 1,
      },
      taskView: false,
      isReadOnly: true,

      // scheduleView: false,
      // template: {
      //   monthGridHeader: (model) => {
      //     var date = new Date(model.date);
      //     var template = '<div class="tui-full-calendar-weekday-grid-date text-isms-500 border-b w-full">' + date.getDate() + "</div>";
      //     return template;
      //   },
      //   dayGridTitle: (day) => {
      //     var template = '<span class="tui-full-calendar-weekday-grid-date text-isms-500 border-b">' + day + ">></span>";
      //     return template;
      //   }
      //   // monthGridHeader: function (data) {
      //   //   var date = parseInt(data.date.split("-")[2], 10);

      //   //   return '<span class="calendar-month-header" style="margin-left: 4px;">' + (data.month + 1) + "/" + date + "</span>";
      //   // },
      //   // monthGridHeaderExceed: function (hiddenEvents) {
      //   //   return '<span class="calendar-month-header-exceed" style="font-size: 0.8rem">' + "+" + hiddenEvents + "</span>";
      //   // },
      //   // monthDayname: function (data) {
      //   //   var label = data.label;

      //   //   if (data.day === 5) {
      //   //     label = "🎉 TGIF";
      //   //   }

      //   //   return '<span class="calendar-month-day-name">' + label + "</span>";
      //   // }
      // }
    });

    // setTimeout(() => {
    //   cal.changeView('week', true);
    // }, 2000);
    // this.tuiCalendar.setCalendars([
    //   {
    //     id: "12356756",
    //     name: "Data",
    //     color: "red",
    //     bgColor: "red",
    //     dragBgColor: "red",
    //     borderColor: "red"
    //   },
    //   {
    //     id: "cal1",
    //     name: "Personal",
    //     bgColor: "#03bd9e"
    //   },
    //   {
    //     id: "cal2",
    //     name: "Work",
    //     bgColor: "#00a9ff"
    //   }
    // ]);

    this.tuiCalendar.createSchedules([
      {
        id: "1",
        calendarId: "12356756",
        title: "Web Developer Interview",
        body: "Programmer meeting",
        category: "time",
        color: "orange",
        bgColor: "#EEEEEE",
        dragBgColor: "blue",
        borderColor: "pink",
        isReadOnly: true,
        start: DateTime.now().toISO(),
        end: DateTime.now().plus({ days: 3 }).toISO(),
      },
      {
        id: "2",
        calendarId: "12356756",
        title: "Web Developer Interview",
        body: "Programmer meeting",
        category: "time",
        color: "orange",
        bgColor: "#EEEEEE",
        dragBgColor: "blue",
        borderColor: "pink",
        isReadOnly: true,
        start: DateTime.now().plus({ days: 1 }).toISODate(),
        end: DateTime.now().plus({ days: 3 }).toISO(),
      },
      {
        id: "2",
        calendarId: "12356756",
        title: "Web Developer Interview",
        body: "Programmer meeting",
        category: "time",
        color: "orange",
        bgColor: "#EEEEEE",
        dragBgColor: "blue",
        borderColor: "pink",
        isReadOnly: true,
        start: DateTime.now().plus({ days: 1 }).toISODate(),
        end: DateTime.now().plus({ days: 2 }).toISO(),
      },
    ]);

    this.tuiCalendar.on({
      clickSchedule: (e) => {
        console.log("clickSchedule", e.schedule.title);
      },
      beforeCreateSchedule: (e) => {
        console.log("beforeCreateSchedule", e);
        // open a creation popup
      },
      beforeUpdateSchedule: (e) => {
        console.log("beforeUpdateSchedule", e);
        e.schedule.start = e.start;
        e.schedule.end = e.end;
        // this.tuiCalendar.updateSchedule(e.schedule.id, e.schedule.calendarId, e.schedule);
      },
      beforeDeleteSchedule: (e) => {
        console.log("beforeDeleteSchedule", e);
        this.tuiCalendar.deleteSchedule(e.schedule.id, e.schedule.calendarId);
      },
    });
  }

  public ngOnInit(): void {}
}
