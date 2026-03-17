import { Pipe, PipeTransform } from "@angular/core";
import { round } from "lodash";

@Pipe({
  name: "formattedCurrency",
  standalone: true,
})
export class FormattedCurrencyPipe implements PipeTransform {
  transform(value: number) {
    if (typeof value === "string") {
      return `₫${parseInt(value)
        .toFixed(0)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    }
    return `₫${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  }
}
