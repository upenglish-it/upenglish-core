import { Component, HostListener, OnDestroy, OnInit } from "@angular/core";
import { FormArray, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzButtonModule } from "ng-zorro-antd/button";
import { UploadFileDirective } from "@isms-core/directives";
import { FileManagerService, NGRXService, StudentsService } from "@isms-core/services";
import { lastValueFrom } from "rxjs";
import { EmailValidatorPattern } from "@isms-core/constants";
import { parsePhoneNumber } from "libphonenumber-js";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { CreateStudentFormGroup, StudentGuardianFormGroup } from "@isms-core/form-group";
import { getProperty } from "dot-prop";
import * as dotObject from "dot-object";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzIconModule } from "ng-zorro-antd/icon";
import { SubSink } from "subsink";
import { IBranch } from "@isms-core/interfaces";
import { isEmpty } from "lodash";
import { DateTime } from "luxon";
import * as Papa from "papaparse";

@Component({
  selector: "isms-import-student-from-csv-drawer",
  templateUrl: "./import-student-from-csv-drawer.component.html",
  imports: [
    NgIf,
    NgFor,
    JsonPipe,
    FormsModule,
    ReactiveFormsModule,
    NzDrawerModule,
    NzSelectModule,
    NzButtonModule,
    NzPopconfirmModule,
    NzInputModule,
    NzIconModule,
    UploadFileDirective,
  ],
})
export class ImportStudentFromCSVDrawerComponent implements OnDestroy {
  private subSink: SubSink = new SubSink();
  public branches: Array<IBranch> = [];
  public selectedBranch: string = null;
  public showDrawer: boolean = false;
  public systemFields: Array<ISystemFields> = SystemFields();
  public drawerWidth: string = "100%";

  public importCSVFormGroup: FormGroup = new FormGroup({
    stepView: new FormControl("upload-csv"), // upload-csv, map-data, add-reference, success
    records: new FormArray([]),
    transformedRecords: new FormControl([]),
    previewRecords: new FormControl([]),
    previewRecordsIndex: new FormControl(0),
    header: new FormControl([]),
    branches: new FormControl([]),
    tags: new FormArray([]),
    sources: new FormArray([]),
  });

  @HostListener("window:resize", [])
  onResize(): void {
    this.updateDrawerWidth();
  }

  constructor(
    private readonly fileManagerService: FileManagerService,
    private readonly studentsService: StudentsService,
    private readonly nzNotificationService: NzNotificationService,
    private readonly ngrxService: NGRXService
  ) {
    this.subSink.add(this.ngrxService.branches().subscribe((res) => (this.branches = res)));
    this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));
    this.updateDrawerWidth();
  }

  private updateDrawerWidth(): void {
    if (typeof window !== "undefined") {
      this.drawerWidth = window.innerWidth < 640 ? "100%" : "780px";
    }
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  public toggle(): void {
    this.showDrawer = !this.showDrawer;
  }

  public onDropFile(fileList: FileList): void {
    this.manageFiles(fileList);
  }

  public onUploadFile(event: Event): void {
    const eventTarget = event.target as HTMLInputElement;
    this.manageFiles(eventTarget.files);
  }

  public async manageFiles(fileList: FileList): Promise<void> {
    const file = fileList[0];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result, file) => {
        // console.log("headers: ", Object.values(result.meta.fields), result);
        // // console.log("values: ", Object.values(result.data));
        // // console.log("values: ", JSON.stringify(result.data));
        // for (const element of result.data) {
        //   console.log("values: ", Object.values(element));
        // }
        //   }
        // });

        // const formData = new FormData();
        // const blob = new Blob([file], { type: file.type });
        // formData.append("file", blob);

        // lastValueFrom(this.fileManagerService.extractCSV(formData, "utf-8")).then((res) => {
        //   if (res.success) {

        const header: Array<IFieldMapping> = (result.meta.fields as Array<string>).map((h: string) => {
          return {
            csvField: h,
            systemField: null,
          } as any;
        });
        this.importCSVFormGroup.get("header").setValue(header);

        const records = result.data.map((r) => Object.values(r));

        /* remove the empty record */

        this.importCSVFormGroup.get("previewRecords").setValue(records);

        // console.log("filteredRecords", filteredRecords);
        records.forEach((record: Array<string>) => {
          // console.log("record", record, record.length, record.length > 1, record.length > 2);
          const formGroup = CreateStudentFormGroup();
          formGroup.get("firstName").setValue(record[0]);
          formGroup.get("lastName").setValue(record[1]);

          if (!isEmpty(record[2])) {
            (formGroup.get("emailAddresses") as FormArray).push(
              new FormControl(record[2], [Validators.required, Validators.maxLength(32), Validators.email, Validators.pattern(EmailValidatorPattern)])
            );
          }

          console.log("record[3]", record[3]);

          const number = record[3].includes("+") ? record[3] : `+${record[3]}`;

          let countryCallingCode = null;
          let nationalNumber = null;

          try {
            const parsedNumber = parsePhoneNumber(number);
            countryCallingCode = parsedNumber.countryCallingCode;
            nationalNumber = parsedNumber.nationalNumber;
          } catch (error) { }

          if (countryCallingCode) {
            (formGroup.get("contactNumbers") as FormArray).push(
              new FormGroup({
                countryCallingCode: new FormControl(`+${countryCallingCode}`, [Validators.required]),
                number: new FormControl(nationalNumber, [Validators.required]),
              })
            );
          }

          formGroup.get("gender").setValue((record[4] || "").toLowerCase());

          console.log("record>>>", record[5], DateTime.fromFormat(record[5], "d/M/yy").toISODate());
          if (!isEmpty(record[5])) {
            formGroup.get("birthDate").setValue(DateTime.fromFormat(record[5], "d/M/yy").toISODate());
          }

          formGroup.get("address").get("street").setValue(record[6]);
          formGroup.get("address").get("city").setValue(record[7]);
          formGroup.get("address").get("country").setValue(record[8]);
          formGroup.get("address").get("state").setValue(record[9]);
          formGroup.get("address").get("postalCode").setValue(record[10]);
          formGroup.get("address").get("timezone").setValue(record[11]);

          if (!isEmpty(record[12])) {
            record[12]
              .split(",")
              .map((v) => v.trim())
              .forEach((v) => {
                (formGroup.get("sources") as FormArray).push(new FormControl(v, [Validators.required, Validators.maxLength(32)]));
              });
          }

          if (!isEmpty(record[13])) {
            record[13]
              .split(",")
              .map((v) => v.trim())
              .forEach((v) => {
                (formGroup.get("tags") as FormArray).push(new FormControl(v, [Validators.required, Validators.maxLength(32)]));
              });
          }

          if (!isEmpty(record[14])) {
            record[14].split(",").forEach((v) => {
              const value = v.split("+");

              console.log("value", value);

              // const guardiansFormArray = formGroup.get("guardians") as FormArray;

              const guardianFormGroup = StudentGuardianFormGroup();
              guardianFormGroup.get("name").setValue(value[0].trim());
              guardianFormGroup.get("relationship").setValue(value[1].trim());

              if (!isEmpty(value[2])) {
                guardianFormGroup.get("primaryNumber").setValue(value[2].trim());
              }

              if (!isEmpty(value[3])) {
                guardianFormGroup.get("secondaryNumber").setValue(value[3].trim());
              }

              (formGroup.get("guardians") as FormArray).push(guardianFormGroup);
            });
            console.log("guardians", formGroup);
          }

          if (!isEmpty(record[15])) {
            formGroup.get("additionalNotes").setValue(record[15]);
          }

          formGroup.get("official").setValue(true);
          this.recordsFormArray.push(formGroup);
        });

        this.importCSVFormGroup.get("stepView").setValue("map-data");
      },
    });

    // for (let i = 0; i < fileList.length; i++) {
    //   const file = fileList[i];
    //   console.log("file", file);
    //   const isExist = this.recordsFormArray.value.find((value: { name: string }) => value.name === file.name);
    //   if (!isExist) {
    //     const blob = new Blob([file], { type: file.type });
    //     // this.fileFormArray.push(
    //     //   new FormGroup({
    //     //     name: new FormControl(file.name),
    //     //     type: new FormControl(file.type),
    //     //     blob: new FormControl(blob),
    //     //     file: new FormControl(file)
    //     //   })
    //     // );
    //   }
    // }
  }

  public async onSubmit(): Promise<void> {
    console.log(this.recordsFormArray.value);
    // const notificationTitle = 'Upload File';
    // this.submitting = true;
    // const formData = new FormData();
    // for (let i = 0; i < this.recordsFormArray.value.length; i++) {
    //   const fileForm = this.fileFormArray.value[i];
    //   const file: File = fileForm.file as File;
    //   // formData.append('file', file.blob);
    //   const fileFormArray = this.formGroup.get("files") as FormArray;
    //   fileFormArray.push(
    //     new FormGroup({
    //       id: new FormControl(null, [Validators.required]),
    //       originalFileName: new FormControl(file.name, [Validators.required]),
    //       fileName: new FormControl(null, [Validators.required]),
    //       uploadStatus: new FormControl("waiting", [Validators.required]),
    //       extractionStatus: new FormControl(null, [Validators.required]),
    //       extractionStatusMessage: new FormControl(null, [Validators.required]),
    //       value: new FormControl(null, [Validators.required]),
    //       uploadCreatedAt: new FormControl(null, [Validators.required]),
    //       extractionCreatedAt: new FormControl(null, [Validators.required]),
    //       blob: new FormControl(fileForm.blob, [Validators.required])
    //     })
    //   );
    // }
  }

  public onNextStep(): void {
    const stepView = this.importCSVFormGroup.value.stepView;

    console.log("stepView", stepView);
    if (stepView === "map-data") {
      const records: Array<IStudent> = this.recordsFormArray.value;
      const transformedRecords: Array<any> = [];
      records.forEach((record) => {
        let transformedData = {};
        (this.importCSVFormGroup.value.header as Array<IFieldMapping>).forEach((header) => {
          if (header.systemField) {
            transformedData = {
              ...transformedData,
              ...{
                [header.systemField]: getProperty(record, header.systemField),
              },
            };
          }
        });

        // console.log("transformedData", transformedData);

        transformedRecords.push(transformedData);
      });
      transformedRecords.map((data) => dotObject.object(data));
      this.importCSVFormGroup.get("transformedRecords").setValue(transformedRecords);

      let proceed = true;
      for (const record of transformedRecords) {
        if (Object.keys(record).length === 0) {
          this.nzNotificationService.error("Map CSV Fields", "There's no mapped fields. Please check carefully the column in UP English!");
          proceed = false;
          return;
        }
      }

      if (proceed) {
        this.importCSVFormGroup.get("stepView").setValue("add-reference");
      }
    }

    if (stepView === "add-reference") {
      console.log("this.importCSVFormGroup.value.sources", this.importCSVFormGroup.value.sources);

      const transformedRecords = this.importCSVFormGroup.value.transformedRecords.map((record: IStudent) => {
        console.log("record.tags", record);
        return {
          ...record,
          tags: [...(record?.tags || []), ...this.tagsFormArray.value],
          sources: [...(record?.sources || []), ...this.sourcesFormArray.value],
          branches: this.importCSVFormGroup.value.branches,
          createdFrom: "csv",
        };
      });

      lastValueFrom(
        this.studentsService.bulkCreate({
          records: transformedRecords,
          // tags: this.tagsFormArray.value,
          // sources: this.sourcesFormArray.value,
          // branches: this.importCSVFormGroup.value.branches
        })
      ).then((res) => {
        console.log("res", res);
        if (res.success) {
          this.importCSVFormGroup.get("stepView").setValue("success");
        } else {
          this.nzNotificationService.error("Import CSV", res.message);
        }
      });

      // this.importCSVFormGroup.get("stepView").setValue("success");
    }
  }

  public goBack() {
    const stepView = this.importCSVFormGroup.value.stepView;
    if (stepView === "map-data") {
      this.importCSVFormGroup.get("stepView").setValue("upload-csv");
    }
    if (stepView === "add-reference") {
      this.importCSVFormGroup.get("stepView").setValue("map-data");
    }
  }

  public uploadNewFile(): void {
    this.importCSVFormGroup.get("stepView").setValue("upload-csv");
    this.recordsFormArray.clear();
    this.importCSVFormGroup.get("previewRecordsIndex").setValue(0);
    this.importCSVFormGroup.get("previewRecords").setValue([]);
    this.importCSVFormGroup.get("header").setValue([]);
  }

  public previewRecords(): void {
    let previewRecordsIndex = this.importCSVFormGroup.value.previewRecordsIndex + 1;
    if (this.importCSVFormGroup.value.previewRecordsIndex === this.recordsFormArray.length) {
      previewRecordsIndex = 0;
    }
    this.importCSVFormGroup.get("previewRecordsIndex").setValue(previewRecordsIndex);
  }

  public addTag(): void {
    this.tagsFormArray.push(new FormControl("", [Validators.required, Validators.maxLength(32)]));
  }

  public removeTag(index: number): void {
    this.tagsFormArray.removeAt(index);
  }

  public addSource(): void {
    this.sourcesFormArray.push(new FormControl("", [Validators.required, Validators.maxLength(32)]));
  }

  public removeSource(index: number): void {
    this.sourcesFormArray.removeAt(index);
  }

  public hideSelectedBranch(branchId: string): boolean {
    return this.importCSVFormGroup.value.branches.indexOf(branchId) >= 0 || this.selectedBranch === branchId;
  }

  public get recordsFormArray(): FormArray {
    return this.importCSVFormGroup.get("records") as FormArray;
  }

  public get tagsFormArray(): FormArray {
    return this.importCSVFormGroup.get("tags") as FormArray;
  }

  public get sourcesFormArray(): FormArray {
    return this.importCSVFormGroup.get("sources") as FormArray;
  }
}

interface IFieldMapping {
  csvField: string;
  systemField: string | null;
}

const SystemFields = (): Array<ISystemFields> => {
  return [
    {
      name: "First Name",
      value: "firstName",
    },
    {
      name: "Last Name",
      value: "lastName",
    },
    {
      name: "CMND/CCCD",
      value: "cmnd",
    },
    {
      name: "Gender",
      value: "gender",
    },
    {
      name: "Birth Date",
      value: "birthDate",
    },
    {
      name: "Email Address",
      value: "emailAddresses",
    },
    {
      name: "Contact Numbers",
      value: "contactNumbers",
    },
    {
      name: "Street Address",
      value: "address.street",
    },
    {
      name: "City",
      value: "address.city",
    },
    {
      name: "Country",
      value: "address.country",
    },
    {
      name: "State",
      value: "address.state",
    },
    {
      name: "Postal Code",
      value: "address.postalCode",
    },
    {
      name: "Timezone",
      value: "address.timezone",
    },
    {
      name: "Tags",
      value: "tags",
    },
    {
      name: "Sources",
      value: "sources",
    },
    {
      name: "Guardians",
      value: "guardians",
    },
    {
      name: "Additional Notes",
      value: "additionalNotes",
    },
  ];
};

interface ISystemFields {
  name: string;
  value: string;
}

interface IStudent {
  firstName: string;
  lastName: string;
  emailAddresses: Array<string>;
  contactNumbers: { countryCallingCode: string; number: string };
  gender: string;
  birthDate: string;
  address: {
    street: string;
    city: string;
    country: string;
    state: string;
    postalCode: string;
    timezone: string;
  };
  tags: Array<string>;
  sources: Array<string>;
}
