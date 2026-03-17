import { Directive, HostListener, Input } from "@angular/core";
import { environment } from "@isms-env/environment";
import { isEmpty } from "lodash";
import { DateTime } from "luxon";
import * as XLSX from "xlsx";
@Directive({
  selector: "[export-json-to-csv]",
  standalone: true,
})
export class ExportJSONToCSVDirective {
  @Input("data") data: Array<any> = [];

  @HostListener("click", ["$event"])
  public onClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    console.log("test", this.data);

    const mappedData = this.data;
    // .map((d, index) => {
    //   const accountId = d.accountId;
    //   d["Id"] = index + 1;
    //   delete d._id;
    //   delete d.accountId;
    //   delete d.notification;
    //   delete d.lockScreen;
    //   delete d.address;
    //   delete d.properties;
    //   delete d.sourceBranch;
    //   delete d.propertiesBranches;
    //   delete d.guardians;
    //   delete d.createdFrom;
    //   delete d.enrolled;
    //   delete d.official;
    //   delete d.active;
    //   delete d.updatedAt;
    //   delete d.deleted;
    //   delete d.lead;
    //   d.tags = d.tags.join(",");
    //   d.sources = d.sources.join(",");
    //   d.emailAddresses = d.emailAddresses.join(",");
    //   d.contactNumbers = !isEmpty(d.contactNumbers) ? d.contactNumbers.map((cn: { countryCallingCode: any; number: any }) => `${cn.countryCallingCode}${cn.number}`).join(",") : "";
    //   return {
    //     Id: index + 1,
    //     "Student Id": accountId,
    //     ...d
    //   };
    // });

    const fileName: string = `${environment.appName}-${DateTime.now().toISODate()}`;
    this.exportToExcel(mappedData, fileName);
  }

  private exportToExcel(jsonData: any[], fileName: string): void {
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(jsonData);
    const workbook: XLSX.WorkBook = { Sheets: { data: worksheet }, SheetNames: ["data"] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    this.saveAsExcelFile(excelBuffer, fileName);
  }

  private saveAsExcelFile(buffer: any, fileName: string): void {
    const data: Blob = new Blob([buffer], { type: "application/octet-stream" });
    const url: string = window.URL.createObjectURL(data);
    const link: HTMLAnchorElement = document.createElement("a");
    link.href = url;
    link.download = fileName + ".xlsx";
    link.click();
    window.URL.revokeObjectURL(url);
    link.remove();
  }
}
