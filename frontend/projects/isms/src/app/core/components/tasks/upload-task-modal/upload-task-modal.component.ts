import { Component, EventEmitter, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ICourse, Task } from "@isms-core/interfaces";
import { NzModalModule } from "ng-zorro-antd/modal";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzButtonModule } from "ng-zorro-antd/button";
import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NumberOnlyDirective } from "@isms-core/directives";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { lastValueFrom } from "rxjs";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzTimePickerModule } from "ng-zorro-antd/time-picker";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { UploadTaskFormGroup } from "@isms-core/form-group";
import { TasksService } from "@isms-core/services";
import { ActivatedRoute, Router } from "@angular/router";
import { SYSTEM_ID } from "@isms-core/utils";
import * as Papa from "papaparse";
interface UploadTask {
  type: "challenge" | "homework";
}

@Component({
  selector: "isms-upload-task-modal",
  templateUrl: "./upload-task-modal.component.html",
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    NzDrawerModule,
    NzModalModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzIconModule,
    NzRadioModule,
    NzToolTipModule,
    NzDatePickerModule,

    NzTimePickerModule,
  ],
})
export class UploadTaskModalComponent {
  @Output("on-submitted") onSubmitted: EventEmitter<void> = new EventEmitter();
  public uploadTaskFormGroup: FormGroup = UploadTaskFormGroup();
  public viewState: "initial" | "submitting" = "initial";
  public showModal: boolean = false;
  public task: Partial<Task> | null = null;
  public taskTypes = [
    { name: "Challenge", value: "challenge" },
    { name: "Homework", value: "homework" },
  ];

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly tasksService: TasksService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public toggle(): void {
    this.showModal = !this.showModal;
    this.uploadTaskFormGroup.reset();
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
        // const formData = new FormData();
        // const blob = new Blob([file], { type: file.type });
        // formData.append("file", blob);

        // lastValueFrom(this.fileManagerService.extractCSV(formData, "utf-8")).then((res) => {
        //   if (res.success) {
        //     const header: Array<any> = (res.data.header as Array<string>).map((h: string) => {
        //       return {
        //         csvField: h,
        //         systemField: null
        //       };
        //     });

        const records = result.data.map((r) => Object.values(r));

        // console.log("header", header);

        const task: Partial<Task> = {
          generalInfo: {
            type: this.uploadTaskFormGroup.value.type,
            title: this.uploadTaskFormGroup.value.title,
            passing: 100,
            instances: 10,
            duration: {
              noExpiration: false,
              value: 0,
              type: "hour",
            },
            expand: true,
          },
          assignee: {
            reviewers: [],
            participants: [],
            expand: true,
          },
          categories: [],
          status: "unpublished",
          mode: "official",
          course: null,
          class: null,
        };

        const grouped: { id: string; record: any; data: any[] }[] = [];

        records.forEach((record) => {
          const isExistIndex = grouped.findIndex((g) => g.id === record[0]);

          if (isExistIndex !== -1) {
            grouped[isExistIndex].data.push(record);
          } else {
            grouped.push({
              id: record[0],
              record: record,
              data: [record],
            });
          }
        });

        // = groupBy(
        //   res.data.records.map((r: any) => {
        //     return {
        //       id: r[0],
        //       data: r
        //     };
        //   }),
        //   "id"
        // );

        console.log("grouped", grouped);

        // console.log("task 1", task);

        for (const gd of grouped) {
          const recordsData = gd.data;
          const record = gd.record;
          //  [
          //       "1", // id number
          //       "harm", // script
          //       "Choose the correct word", // question
          //       "ham", //  choice 1
          //       "harm", //  choice 2
          //       null, //  choice 3
          //       null, //  choice 4
          //       "B", //  correct answer
          //       "0.75", // pointes
          //       "choices" // mode
          //   ],

          console.log("gd", gd);
          const idNumber = gd.id;
          // const script = record[1];
          // const question = record[2];
          // const choice1 = record[3];
          // const choice2 = record[4];
          // const choice3 = record[5];
          // const choice4 = record[6];
          // const correctAnswer = record[7];
          const questionTitle = record[1];
          const points = record[9];
          // const questionType = record[9];
          // const checkMode = record[10];

          const questions: any[] = recordsData.map((category: any) => {
            // const idNumber = category[0];
            // const questionTitle = category[1]
            const script = category[3];
            const question = category[2];
            const choice1 = category[4];
            const choice2 = category[5];
            const choice3 = category[6];
            const choice4 = category[7];
            const correctAnswer = category[8];
            // const points = category[9];
            const questionType: "choices" | "fill-in" = category[10];
            const checkMode = category[11];

            const choices = [];
            if (choice1) {
              choices.push({
                id: SYSTEM_ID(),
                value: choice1,
              });
            }
            if (choice2) {
              choices.push({
                id: SYSTEM_ID(),
                value: choice2,
              });
            }
            if (choice3) {
              choices.push({
                id: SYSTEM_ID(),
                value: choice3,
              });
            }
            if (choice4) {
              choices.push({
                id: SYSTEM_ID(),
                value: choice4,
              });
            }

            console.log("questionType > ", questionType, choices, category);

            const originalAnswer = questionType === "choices" ? choices.at(parseInt(correctAnswer) - 1).id : correctAnswer;

            return {
              expand: true,
              id: category[0],
              title: question,
              description: script,
              type: questionType,
              choices: choices,
              originalAnswer: originalAnswer,
              // attendeeAnswer: null,
              fillInScore: 0,
              check: checkMode,
              reviewerAnswer: null,
              // conclusion: null,
              // reviewerScore: 0,
              // reviewStatus: "pending"
            } as any;
          });
          task.categories.push({
            id: idNumber,
            title: questionTitle,
            points: parseFloat(points),
            questions: questions,
          });
        }

        // console.log("task 2", task);
        this.task = task;
      },
    });
  }

  public onCreate(): void {
    this.viewState = "submitting";
    lastValueFrom(this.tasksService.importCSV({ records: [this.task] }))
      .then((res) => {
        if (res.success) {
          this.onSubmitted.emit();
          this.toggle();
        }
      })
      .finally(() => {
        this.viewState = "initial";
      });
  }
}
