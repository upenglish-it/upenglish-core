import { Pipe, PipeTransform } from "@angular/core";
import { AbstractControl, FormArray } from "@angular/forms";
import * as moment from "moment";
// moment.locale('pt-br');

@Pipe({
  name: "sortFormArray",
  pure: false,
  standalone: true,
})
export class SortFormArrayPipe implements PipeTransform {
  transform(formArray: Array<AbstractControl<any>>, orderField: string) {
    if (!formArray || !(formArray instanceof FormArray)) {
      return formArray;
    }

    return formArray.slice().sort((a: any, b: any) => a.value[orderField] - b.value[orderField]);
  }
}
