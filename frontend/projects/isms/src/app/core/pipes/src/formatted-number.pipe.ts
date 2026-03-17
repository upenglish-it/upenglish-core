import { Pipe, PipeTransform } from "@angular/core";
import { parsePhoneNumber } from "libphonenumber-js";

@Pipe({
  name: "formattedNumber",
  standalone: true,
})
export class FormattedNumberPipe implements PipeTransform {
  transform(value: string) {
    console.log("value", value);
    return parsePhoneNumber(value).formatInternational();
  }
}
