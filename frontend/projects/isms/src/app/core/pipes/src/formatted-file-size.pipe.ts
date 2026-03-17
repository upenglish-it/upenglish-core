import { Pipe, PipeTransform } from "@angular/core";
import { filesize } from "filesize";

@Pipe({
  name: "formattedFileSize",
  standalone: true,
})
export class FormattedFileSizePipe implements PipeTransform {
  transform(sizeInBytes: number): string {
    return filesize(sizeInBytes, { round: 0 }) as string;
  }
}
