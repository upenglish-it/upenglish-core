import { DatePipe, JsonPipe, NgFor, NgIf } from "@angular/common";
import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NgxTinymceModule } from "ngx-tinymce";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { debounceTime, defaultIfEmpty, distinctUntilChanged, filter, lastValueFrom } from "rxjs";
import { ClassesService, StaffsService, StudentsService, TasksService, TasksSubjectService } from "@isms-core/services";
import { IAccount, IClass, INameValue, Task } from "@isms-core/interfaces";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { SubSink } from "subsink";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { isEmpty } from "lodash";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { ParticipantFormGroup } from "@isms-core/form-group";
import { NzPopoverModule } from "ng-zorro-antd/popover";
import { NzListModule } from "ng-zorro-antd/list";

@Component({
  selector: "isms-task-assignee",
  templateUrl: "./task-assignee.component.html",
  imports: [
    NgIf,
    NgFor,
    DatePipe,
    JsonPipe,
    ReactiveFormsModule,
    NzSelectModule,
    NzInputModule,
    NzInputNumberModule,
    NzDatePickerModule,
    NzSwitchModule,
    NzToolTipModule,
    NzButtonModule,
    NzModalModule,
    NzIconModule,
    NzRadioModule,
    NzPopoverModule,
    NzListModule,
    NzPopconfirmModule,
    NzEmptyModule,
    NgxTinymceModule,
    ProfilePhotoDirective,
  ],
})
export class TaskAssigneeComponent implements OnInit, OnDestroy {
  @Input("form-group") formGroup: FormGroup;
  @Input("task") task: Task;
  private subSink = new SubSink();
  public staffs: Array<IAccount> = [];
  public assignedParticipants: Array<INameValue> = [];
  public showParticipantsModal: boolean = false;

  public filteredParticipants: Array<INameValue> = [];
  public filterParticipantFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    type: new FormControl("class"),
  });

  constructor(
    private readonly staffsService: StaffsService,
    private readonly studentsService: StudentsService,
    private readonly classesService: ClassesService,
    private readonly tasksService: TasksService,
    private readonly tasksSubjectService: TasksSubjectService
  ) {}

  public ngOnInit(): void {
    this.loadData();
    lastValueFrom(this.staffsService.fetch({ includeMe: true })).then((res) => (res.success ? (this.staffs = res.data) : []));
    this.subSink.add(this.tasksSubjectService.received().subscribe((value) => this.loadData()));

    // this.subSink
    //   .add
    // this.participantsFormArray.valueChanges.pipe(debounceTime(500), distinctUntilChanged()).subscribe((value) => {
    //   console.log(">>>", value);
    //   this.loadData();
    // })
    // ();
    this.subSink.add(
      this.filterParticipantFormGroup.valueChanges
        .pipe(
          filter((v) => !isEmpty(v.searchQuery)),
          debounceTime(500),
          distinctUntilChanged()
        )
        .subscribe((value: { searchQuery: string; type: "class" | "student" }) => {
          this.filteredParticipants = [];
          if (value.type === "student") {
            lastValueFrom(this.studentsService.fetch({ name: value.searchQuery })).then((res) => {
              console.log("staff", res);
              res.success
                ? (this.filteredParticipants = res.data.map((v: IAccount) => {
                    return {
                      name: `${v.firstName} ${v.lastName}`.trim(),
                      value: { emailAddress: v.emailAddresses[0], id: v._id, type: "student" },
                    };
                  }))
                : [];
            });
          }
          if (value.type === "class") {
            lastValueFrom(this.classesService.fetch({ name: value.searchQuery, showTotalMembers: true })).then((res) => {
              console.log("staff", res);
              res.success
                ? (this.filteredParticipants = res.data.map((v: IClass) => {
                    return {
                      name: v.name,
                      value: { id: v._id, totalMembers: v.totalMembers, type: "class", studentsTuitionAttendance: v.studentsTuitionAttendance },
                    };
                  }))
                : [];
            });
          }
        })
    );
  }

  public loadData(): void {
    // if (this.participantsFormArray.value.length > 0) {
    lastValueFrom(this.tasksService.assigneeParticipants(this.task._id)).then((res) => {
      this.assignedParticipants = res.success ? res.data : [];
    });
    // }
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  public toggleParticipantsModal(): void {
    this.showParticipantsModal = !this.showParticipantsModal;
  }

  public onAddParticipant(participant: INameValue): void {
    const participantFormGroup = ParticipantFormGroup();
    participantFormGroup.get("id").setValue(participant.value.id);
    participantFormGroup.get("type").setValue(participant.value.type);
    this.participantsFormArray.push(participantFormGroup);
  }

  public removeParticipant(participantIndex: number, participantData: any): void {
    // const participant = this.participantsFormArray.at(participantIndex).value;
    // console.log("participantsFormArray", participant, this.task.assignee.participants, participantData);

    let ids = [];
    const type = participantData.value.type;
    if (type === "student") {
      ids = [participantData.value.id];
    } else {
      ids = participantData.value.members.studentsTuitionAttendance.map((s: { student: string }) => {
        return s.student;
      });
    }

    lastValueFrom(
      this.tasksService.manageParticipantInstance(this.task._id, {
        ids: ids,
        type: type,
      })
    )
      .then()
      .finally(() => {
        this.participantsFormArray.removeAt(participantIndex);
      });
  }

  public isReviewerSelected = (id: string) => this.assigneeFormGroup.value?.reviewers?.indexOf(id) >= 0;

  public get assigneeFormGroup(): FormGroup {
    return this.formGroup.get("assignee") as FormGroup;
  }

  public get participantsFormArray(): FormArray {
    return this.assigneeFormGroup.get("participants") as FormArray;
  }

  public participantAlreadyAdded(id: string): boolean {
    return this.participantsFormArray.value.find((p: { id: string }) => p.id === id);
  }
}
