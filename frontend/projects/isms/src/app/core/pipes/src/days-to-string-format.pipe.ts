import { Pipe, PipeTransform } from "@angular/core";
import * as moment from "moment";

@Pipe({
  name: "daysToStringFormat",
  standalone: true,
})
export class DaysToStringFormatPipe implements PipeTransform {
  transform(days: any, type: "long" | "short" | "narrow"): any {
    if (Object.prototype.toString.call(days) === "[object Array]") {
      return days.map((day: number) =>
        new Date(
          moment()
            .set("day", day + 1)
            .toISOString()
        ).toLocaleString("en-us", { weekday: type })
      );
    }
    return new Date(moment().set("day", days).toISOString()).toLocaleString("en-us", { weekday: type });
  }
}
