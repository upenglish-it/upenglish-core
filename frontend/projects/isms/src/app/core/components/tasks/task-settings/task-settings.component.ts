import { DatePipe, NgClass, NgFor, NgIf, SlicePipe } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { StaffsService, TasksService, TasksSubjectService, TemplatesTagService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { ManageTaskModalComponent } from "../manage-task-modal/manage-task-modal.component";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { SetTaskFormGroup, TaskFormGroup } from "@isms-core/form-group";
import { SectionContainerComponent } from "@isms-core/components/common/section-container/section-container.component";
import { TaskGeneralInfoComponent } from "./task-general-info/task-general-info.component";
import { TaskAssigneeComponent } from "./task-assignee/task-assignee.component";
import { IAccount, Task } from "@isms-core/interfaces";
import { ActivatedRoute } from "@angular/router";
import { SubSink } from "subsink";

@Component({
  selector: "isms-task-settings",
  templateUrl: "./task-settings.component.html",
  imports: [
    NgIf,
    NgFor,
    NgClass,
    ReactiveFormsModule,
    FormsModule,
    NzTagModule,
    NzInputModule,
    NzDropDownModule,
    NzButtonModule,
    NzCheckboxModule,
    NzTagModule,
    NzPopconfirmModule,
    SectionContainerComponent,
    TaskGeneralInfoComponent,
    TaskAssigneeComponent,
  ],
})
export class TaskSettingsComponent implements OnInit, OnDestroy {
  private subSink = new SubSink();
  public task: Task = null;
  private taskId: string = null;
  public taskFormGroup: FormGroup = TaskFormGroup();
  public tabSectionOptions: Array<any> = [
    {
      title: "General Information",
      icon: "ph-info",
      active: false,
      elementId: "general-info-section",
    },
    {
      title: "Assignee",
      icon: "ph-users-four",
      active: false,
      elementId: "assignee-section",
    },
  ];
  public selectedTabSectionIndex = 0;

  constructor(
    private readonly nzNotificationService: NzNotificationService,
    private readonly activatedRoute: ActivatedRoute,
    private readonly tasksService: TasksService,
    private readonly tasksSubjectService: TasksSubjectService
  ) {
    this.taskId = this.activatedRoute.parent.snapshot.paramMap.get("taskId");
    this.subSink.add(
      this.taskFormGroup.valueChanges.pipe(debounceTime(1000), distinctUntilChanged()).subscribe((value: Task) => {
        if (value.status === "published" && this.task.status === "published") {
          this.nzNotificationService.warning("Editing task", 'Task is published. Changes won"t be save.');
        } else {
          lastValueFrom(
            this.tasksService.updateSettingsById(
              {
                generalInfo: value.generalInfo,
                assignee: value.assignee,
                status: value.status,
                mode: value.mode,
                course: value.course,
                class: value.class,
              },
              this.taskId
            )
          ).then((res) => {
            if (res.success) {
              this.tasksSubjectService.send({ type: "updated", data: value });

              if (value.status !== this.task.status) {
                this.nzNotificationService.warning("Editing task", `Task has been ${value.status}`);
              } else {
                this.nzNotificationService.warning("Editing task", "Changes has been saved");
              }

              this.setTask(res.data);
            } else {
              this.nzNotificationService.warning("Editing task", res.message);
            }
          });
        }
      })
    );
  }

  public ngOnInit(): void {
    this.tabSectionOptions[0].active = true;
    this.loadData();
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  public async loadData(): Promise<void> {
    lastValueFrom(this.tasksService.fetchById(this.taskId)).then((res) => {
      if (res.success) {
        this.setTask(res.data);
        SetTaskFormGroup(this.taskFormGroup, this.task, true);
      }
    });
  }

  public async setTask(task: Task): Promise<void> {
    this.task = task;
  }

  public async onSelectSection(index: number): Promise<void> {
    this.selectedTabSectionIndex = index;
    this.tabSectionOptions.map((navigation) => {
      navigation.active = false;
      return navigation;
    });
    this.tabSectionOptions[index].active = true;
    const element = document.getElementById(this.tabSectionOptions[index].elementId);
    if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  public get generalInfoFormGroup(): FormGroup {
    return this.taskFormGroup.get("generalInfo") as FormGroup;
  }

  public get assigneeFormGroup(): FormGroup {
    return this.taskFormGroup.get("assignee") as FormGroup;
  }
}
