import { Pipe, PipeTransform } from "@angular/core";
import * as moment from "moment";
// moment.locale('pt-br');

@Pipe({
  name: "timeago",
  standalone: true,
})
export class TimeAgoPipe implements PipeTransform {
  transform(value: string) {
    let timeAgo = moment(value).fromNow();
    return timeAgo;
  }
}
