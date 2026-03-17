import { Component, ViewChild } from "@angular/core";
import { Animations } from "@isms-core/constants";
import { CdkDragDrop } from "@angular/cdk/drag-drop";
import { StudentsService, TemplatesTagService } from "@isms-core/services";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { PipelineLead, Pipeline, PipelineStage, IAccount, ITag } from "@isms-core/interfaces";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { Subject, debounceTime, lastValueFrom } from "rxjs";
import { TLeadSelectorAction } from "@isms-core/types";
import { ArrayMove } from "@isms-core/utils";
import { NzMessageService } from "ng-zorro-antd/message";
import { DatePipe, NgClass, NgFor, NgIf, NgStyle, SlicePipe } from "@angular/common";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { DragDropModule } from "@angular/cdk/drag-drop";
// import { ChooseLeadModalComponent } from "@isms-core/components/lead/choose-lead-modal/choose-lead-modal.component";
// import { LeadActionSelectorComponent } from "@isms-core/components/lead/lead-action-selector/lead-action-selector.component";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { TimeAgoPipe } from "@isms-core/pipes";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { NzColorPickerModule } from "ng-zorro-antd/color-picker";
// import { DisqualifyLeadModalComponent } from "@isms-core/components/pipeline/disqualify-lead-modal/disqualify-lead-modal.component";
import { PipelinesService } from "@isms-core/services/src/pipelines";
import { ChooseStudentModalComponent } from "@isms-core/components/students/choose-students-modal/choose-students-modal.component";
import { NzModalService } from "ng-zorro-antd/modal";
import { DeletePipelineStageModalComponent } from "@isms-core/components/pipelines/delete-pipeline-stage-modal/delete-pipeline-stage-modal.component";
import { NzTagModule } from "ng-zorro-antd/tag";
import { LeadInfoModalComponent } from "@isms-core/components/pipelines/lead-info-modal/lead-info-modal.component";
import { AddNoteModalComponent } from "@isms-core/components/activity/add-note-modal/add-note-modal.component";
import { StudentInfoDrawerComponent } from "@isms-core/components/students/student-info-drawer/student-info-drawer.component";
import { AddConversationModalComponent } from "@isms-core/components/activity/add-conversation-modal/add-conversation-modal.component";
import { StudentActionSelectorComponent } from "@isms-core/components/students/student-action-selector/student-action-selector.component";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { AddTaskInTaskPipelineModalComponent } from "@isms-core/components/pipelines/add-task-in-task-pipeline-modal/add-task-in-task-pipeline-modal.component";

@Component({
  templateUrl: "./pipeline.page.html",
  animations: [Animations.down],
  styleUrls: ["./pipeline.page.less"],
  imports: [
    NgStyle,
    NgIf,
    NgFor,
    NgClass,
    SlicePipe,
    NgStyle,
    DatePipe,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    NzSelectModule,
    NzToolTipModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
    NzCheckboxModule,
    NzDropDownModule,
    NzEmptyModule,
    NzColorPickerModule,
    NzTagModule,
    TimeAgoPipe,
    ProfilePhotoDirective,
    ChooseStudentModalComponent,
    DeletePipelineStageModalComponent,
    LeadInfoModalComponent,
    AddNoteModalComponent,
    StudentInfoDrawerComponent,
    AddConversationModalComponent,
    StudentActionSelectorComponent,
      AddTaskInTaskPipelineModalComponent,
    // ChooseLeadModalComponent,
    // LeadActionSelectorComponent,
    // DisqualifyLeadModalComponent
  ],
})
export class DesignerPipelinePage {
  @ViewChild("chooseStudentModal") chooseStudentModal: ChooseStudentModalComponent;
  @ViewChild("deletePipelineStageModal") deletePipelineStageModal: DeletePipelineStageModalComponent;
  @ViewChild("leadInfoModal") leadInfoModal: LeadInfoModalComponent;
  @ViewChild("studentInfoDrawer") studentInfoDrawer: StudentInfoDrawerComponent;
  @ViewChild("addNoteModal") public readonly addNoteModal: AddNoteModalComponent;
  @ViewChild("addTaskModal") public readonly addTaskModal: AddTaskInTaskPipelineModalComponent;

  public filterFormGroup = new FormGroup({ query: new FormControl("all") });
  public pipelineStageIds: string[] = [];
  public selectedLeadIds: Array<string> = [];
  public selectedPipelineStageId: string = null;
  public pipelineId: string = null;
  public pipelineType: "leads" | "task" = "leads";
  public preloadedPipeline: Pipeline = null;
  public pipeline: Pipeline = null;
  public segmentIndex = 0;
  public draggingPipeline: boolean = true;
  public onChangeUpdateStage$: Subject<PipelineStage> = new Subject();

  public tags: ITag[] = [];
  constructor(
    private readonly pipelinesService: PipelinesService,
    private readonly studentsService: StudentsService,
    private readonly activatedRoute: ActivatedRoute,
    private readonly nzModalService: NzModalService,
    private readonly templatesTagService: TemplatesTagService
  ) {
    this.pipelineId = this.activatedRoute.snapshot.paramMap.get("pipelineId");
    const typeParam = this.activatedRoute.snapshot.paramMap.get("type") as "leads" | "task";
    this.pipelineType = typeParam || "leads";
  }

  public ngOnInit(): void {
    this.onChangeUpdateStage$.pipe(debounceTime(500)).subscribe((stage: PipelineStage) => {
      console.log("changes here", stage);
      lastValueFrom(
        this.pipelinesService.updateStage(
          {
            stage: { title: stage.title, color: stage.color },
          },
          this.pipeline._id,
          stage.id
        )
      ).then((res) => {
        // if (res.success) {
        //   this.nzMessageService.create(res.success ? "success" : "error", res.message);
        // }
      });
    });

    lastValueFrom(this.templatesTagService.fetch({ type: "pipeline" }))
      .then((res) => {
        this.tags = res.success ? res.data : [];
      })
      .finally(() => {
        this.loadData();
      });
  }

  public loadData(): void {
    lastValueFrom(this.pipelinesService.fetchById(this.pipelineId, this.pipelineType)).then((res) => {
      if (res.success) {
        this.updatePipeline(res.data);
      } else {
        this.pipeline = null;
      }
    });
  }

  public selectedLead: PipelineLead | null = null;
  public selectedStage: PipelineStage | null = null;

  public onDroppedInStage(event: CdkDragDrop<any>, stageId: string): void {
    if (this.pipelineType === "task") {
      this.onDroppedTaskInStage(event, stageId);
      return;
    }
    this.onDroppedLeadInStage(event, stageId);
  }

  public onDroppedTaskInStage(event: CdkDragDrop<any>, stageId: string): void {
    const task = event.item.data as { taskId?: string; id: string; name?: string; notes?: string };
    const isSameContainer =
      event.previousContainer.id !== undefined &&
      event.container.id !== undefined &&
      event.previousContainer.id === event.container.id;
    if (isSameContainer) {
      // Reorder within same stage: just update local state (no backend order API)
      const stage = this.pipeline.sourcingPipeline.stages.find((s) => s.id === stageId);
      if (stage) {
        const tasks = stage.tasks ?? [];
        stage.tasks = ArrayMove(tasks, event.previousIndex, event.currentIndex) as any;
      }
      return;
    }
    // Move to another stage: single update (set task's stage id to target stage id)
    const fromStageId = task.id;
    task.id = stageId;
    this.pipeline.sourcingPipeline.stages.forEach((stage) => {
      if (stage.id === stageId) {
        const tasks = stage.tasks ?? [];
        tasks.splice(event.currentIndex, 0, task);
        stage.tasks = tasks;
      } else {
        const tasks = stage.tasks ?? [];
        const idx = task.taskId
          ? tasks.findIndex((t) => (t as any).taskId === task.taskId)
          : tasks.findIndex((t) => t.id === fromStageId && t.name === task.name);
        if (idx > -1) {
          tasks.splice(idx, 1);
          stage.tasks = tasks;
        }
      }
    });
    const move$ = this.pipelinesService.moveTaskInTaskPipeline(this.pipeline._id, {
      taskId: task.taskId,
      currentStageId: fromStageId,
      moveToStageId: stageId,
      name: task.name ?? "",
      notes: task.notes ?? null,
    });
    lastValueFrom(move$).then((res) => {
      if (!res.success) this.loadData();
    });
  }

  public onDroppedLeadInStage(event: CdkDragDrop<any>, stageId: string): void {
    const lead = event.item.data.info as IAccount;

    this.pipeline.sourcingPipeline.stages.map((stage) => {
      if (stage.id === stageId) {
        if (event.previousContainer === event.container) {
          /* sort leads in stage */
          stage.leads = ArrayMove(stage.leads, event.previousIndex, event.currentIndex);
        } else {
          /* leads move to another stage */
          stage.leads.splice(event.currentIndex, 0, event.item.data);
        }
      } else {
        /* remove lead from previous stage */
        const toBeRemoveLeadIndex = stage.leads.findIndex((c) => c.info._id === lead._id);
        if (toBeRemoveLeadIndex > -1) {
          stage.leads.splice(toBeRemoveLeadIndex, 1);
        }
      }
      const stageLeads = stage.leads.map((lead, index) => {
        return { ...lead, order: index };
      });
      stage.leads = stageLeads;
      return stage;
    });

    const pipelineStages = this.pipeline.sourcingPipeline.stages.find((stage) => stage.id === stageId);

    const leadIds = pipelineStages.leads.map((c) => c.id);

    this.selectedStage = pipelineStages;
    this.selectedLead = pipelineStages.leads.find((l) => l.id === lead._id);

    lastValueFrom(
      this.studentsService.manage({
        action: "add-to-pipeline-with-pipeline-stage",
        pipeline: {
          pipelineIds: [this.pipeline._id],
          pipelineStageId: stageId,
        },
        leadIds: leadIds,
      })
    ).then((res) => {
      this.addNoteModal.formGroup.get("leadIds").setValue(leadIds);
      this.addNoteModal.formGroup.get("pipelineId").setValue(this.pipeline._id);
      this.addNoteModal.formGroup.get("pipelineStageId").setValue(stageId);
      this.addNoteModal.toggle();
      // if (res.success) {
      //   this.nzMessageService.create(res.success ? "success" : "error", "Successfully moved to stage");
      // }
    });
  }

  // public onDroppedLeadInStage(event: CdkDragDrop<any>, stageId: string): void {
  //   const lead = event.item.data.info as ILead;

  //   console.log("lead", lead, event);
  //   this.onMoveLeadInStage({
  //     event,
  //     lead,
  //     stageId
  //   });
  // }

  // public tagLists(ids: string[]): { color: string; name: string }[] {
  //   if (ids.length === 0) {
  //     return [];
  //   }
  //   console.log(">>>>");
  //   const adt: { color: string; name: string }[] = [];
  //   ids.forEach((id) => {
  //     const tag = this.tags.find((t) => t._id === id);
  //     if (tag) {
  //       adt.push({ color: tag.color, name: tag.value });
  //     }
  //   });
  //   return adt;
  // }

  public wonLostManage(): void {
    console.log("this.selectedStage", this.selectedStage);
    if (this.selectedStage.title === "Won" || this.selectedStage.title === "Lost") {
      this.onEditStudent(this.selectedLead.id);
    }
  }

  public onMoveTaskInStage(data: { stageIndex: number; stageTask: { taskId?: string; id: string; name?: string; notes?: string }; stageId: string }): void {
    const task = data.stageTask;
    const fromStageId = task.id;
    this.pipeline.sourcingPipeline.stages.forEach((stage) => {
      if (stage.id === data.stageId) {
        task.id = data.stageId;
        const tasks = stage.tasks ?? [];
        tasks.splice(data.stageIndex, 0, task);
        stage.tasks = tasks;
      } else {
        const tasks = stage.tasks ?? [];
        const idx = task.taskId
          ? tasks.findIndex((t) => (t as any).taskId === task.taskId)
          : tasks.findIndex((t) => t.id === fromStageId && t.name === task.name);
        if (idx > -1) {
          tasks.splice(idx, 1);
          stage.tasks = tasks;
        }
      }
    });
    const move$ = this.pipelinesService.moveTaskInTaskPipeline(this.pipeline._id, {
      taskId: task.taskId,
      currentStageId: fromStageId,
      moveToStageId: data.stageId,
      name: task.name ?? "",
      notes: task.notes ?? null,
    });
    lastValueFrom(move$).then((res) => {
      if (!res.success) this.loadData();
    });
  }

  public onRemoveTaskFromStage(task: { taskId?: string; id: string; name?: string; notes?: string }, stage: PipelineStage): void {
    if (!task.taskId) {
      return;
    }

    this.nzModalService.confirm({
      nzBodyStyle: { "padding-left": "16px", "padding-right": "16px", "padding-bottom": "10px", "padding-top": "16px" },
      nzTitle: `Do you want to remove this task from this stage?`,
      nzOkText: "Delete",
      nzOkType: "primary",
      nzOkDanger: true,
      nzCancelText: "No, Keep it",
      nzOnCancel: () => {},
      nzOnOk: () => {
        const stageIndex = this.pipeline.sourcingPipeline.stages.findIndex((s) => s.id === stage.id);
        if (stageIndex > -1) {
          const tasks = this.pipeline.sourcingPipeline.stages[stageIndex].tasks ?? [];
          const taskIndex = tasks.findIndex((t: any) => t.taskId === task.taskId);
          if (taskIndex > -1) {
            tasks.splice(taskIndex, 1);
            this.pipeline.sourcingPipeline.stages[stageIndex].tasks = tasks;
          }
        }

        lastValueFrom(this.pipelinesService.deleteTaskInTaskPipeline(this.pipeline._id, task.taskId)).then((res) => {
          if (!res.success) {
            this.loadData();
          }
        });
      },
    });
  }

  public onEditTaskInStage(task: { taskId?: string; id: string; name?: string; notes?: string }, stage: PipelineStage): void {
    if (!this.pipeline || !this.pipeline._id) {
      return;
    }
    this.addTaskModal.openForEdit(this.pipeline._id, stage.id, {
      taskId: task.taskId,
      name: task.name,
      notes: task.notes ?? null,
    });
  }

  public onMoveLeadInStage(data: { stageIndex: number; stageLead: PipelineLead; stageId: string }): void {
    this.pipeline.sourcingPipeline.stages.map((stage) => {
      if (stage.id === data.stageId) {
        stage.leads.splice(data.stageIndex, 0, data.stageLead);
      } else {
        /* remove lead from previous stage */
        const toBeRemoveLeadIndex = stage.leads.findIndex((c) => c.info._id === data.stageLead.info._id);
        if (toBeRemoveLeadIndex > -1) {
          stage.leads.splice(toBeRemoveLeadIndex, 1);
        }
      }
      const stageLeads = stage.leads.map((lead, index) => {
        return { ...lead, order: index };
      });
      stage.leads = stageLeads;
      return stage;
    });

    const pipelineStages = this.pipeline.sourcingPipeline.stages.find((stage) => stage.id === data.stageId);

    lastValueFrom(
      this.studentsService.manage({
        action: "add-to-pipeline-with-pipeline-stage",
        pipeline: {
          pipelineIds: [this.pipeline._id],
          pipelineStageId: data.stageId,
        },
        leadIds: pipelineStages.leads.map((c) => c.id),
      })
    ).then((res) => {
      // if (res.success) {
      //   this.nzMessageService.create(res.success ? "success" : "error", "Successfully moved to stage");
      // }
    });
  }

  public onRemoveFromThisPipeline(lead: PipelineLead, stage: PipelineStage): void {
    this.nzModalService.confirm({
      nzBodyStyle: { "padding-left": "16px", "padding-right": "16px", "padding-bottom": "10px", "padding-top": "16px" },
      nzTitle: `Do you want to remove this lead?`,
      nzOkText: "Delete",
      nzOkType: "primary",
      nzOkDanger: true,
      nzCancelText: "No, Keep it",
      nzOnCancel: () => {},
      nzOnOk: () => {
        const stageIndex = this.pipeline.sourcingPipeline.stages.findIndex((s) => s.id === stage.id);
        const leadIndex = this.pipeline.sourcingPipeline.stages[stageIndex].leads.findIndex((c) => c.info._id === lead.info._id);
        console.log(stageIndex, this.pipeline.sourcingPipeline.stages[stageIndex], this.pipeline.sourcingPipeline.stages[stageIndex].leads[leadIndex], leadIndex, lead);
        if (leadIndex > -1) {
          this.pipeline.sourcingPipeline.stages[stageIndex].leads.splice(leadIndex, 1);
        }

        lastValueFrom(
          this.studentsService.manage({
            action: "remove-from-pipelines",
            pipeline: {
              pipelineIds: [this.pipeline._id],
            },
            leadIds: [lead.info._id],
          })
        ).then();
      },
    });
  }

  public onDragStart(dragging: boolean): void {
    // this.draggingPipeline = dragging;
  }

  public onChangeUpdateStage(stage: PipelineStage): void {
    this.onChangeUpdateStage$.next(stage);
  }

  public onClickAddToStage(stageId: string): void {
    if (this.pipelineType === "task") {
      if (this.pipeline && this.pipeline._id) {
        this.addTaskModal.open(this.pipeline._id, stageId);
      }
      return;
    }

    this.selectedPipelineStageId = stageId;
    this.chooseStudentModal.toggle();
  }

  public onChangeSegmentSelector(index: number): void {
    this.segmentIndex = index;
  }

  public onChangeStage(stageId: string, selected: boolean): void {
    this.pipeline.sourcingPipeline.stages.map((stage) => {
      if (stage.id === stageId && (selected || stage.indeterminate)) {
        stage.selected = true;
        stage.indeterminate = false;
        stage.leads.map((lead) => {
          lead.info.selected = true;
          return lead;
        });
      }
      if (stage.id === stageId && !selected && !stage.indeterminate) {
        stage.selected = false;
        stage.indeterminate = false;
        stage.leads.map((lead) => {
          lead.info.selected = false;
          return lead;
        });
      }
      return stage;
    });

    this.manageSelectedLeads();
  }

  // public onChangeUpdateStage(stage: PipelineStage): void {
  //   lastValueFrom(
  //     this.pipelinesService.updateStage(
  //       {
  //         stage: { title: stage.title, color: stage.color }
  //       },
  //       this.pipeline._id,
  //       stage.id
  //     )
  //   ).then((res) => {
  //     console.log(res);
  //   });
  // }

  public onAddNewStage(stageId: string): void {
    const pipelineStage = this.pipeline.sourcingPipeline.stages.find((stage) => stage.id === stageId);
    const pipelineStageIndex = this.pipeline.sourcingPipeline.stages.findIndex((stage) => stage.id === stageId);
    const order = pipelineStageIndex + 1;

    const payload = {
      stage: {
        order: order,
        state: pipelineStage.state,
        type: pipelineStage.type,
        title: "Untitled",
        color: "#f6f8f9",
      },
    };

    const temporaryStages = this.pipeline.sourcingPipeline.stages.map((s) => {
      return { id: s.id, new: false };
    });
    temporaryStages.splice(order, 0, {
      id: null,
      new: true,
    });

    lastValueFrom(
      this.pipelinesService.addStage(
        {
          stage: payload.stage,
          stages: temporaryStages,
        },
        this.pipeline._id,
        this.pipelineType
      )
    ).then((res) => {
      console.log(res);
      if (res.success) {
        this.pipeline.sourcingPipeline.stages.splice(order, 0, {
          ...res.data.stage,
          editable: true,
          selected: false,
          indeterminate: false,
        });
        this.updatePipeStageIds();
        // this.nzMessageService.create(res.success ? "success" : "error", "Stage was successfully added");
      }
    });
  }

  public onRenameStage(input: HTMLInputElement): void {
    input.focus();
  }

  public onRemoveStage(stageId: string, stageIndex: number): void {
    this.deletePipelineStageModal.formGroup.get("pipelineId").setValue(this.pipeline._id);
    this.deletePipelineStageModal.formGroup.get("removePipelineStageId").setValue(stageId);
    this.deletePipelineStageModal.formGroup.get("receiverPipelineStageId").setValue(null);
    this.deletePipelineStageModal.toggle();
  }

  public onRemoveStageResponse(data: { removePipelineStageId: string; receiverPipelineStageId: string }): void {
    const toBeRemovePipelineStageIndex = this.pipeline.sourcingPipeline.stages.findIndex((stage) => stage.id === data.removePipelineStageId);
    const receiverPipelineStageIndex = this.pipeline.sourcingPipeline.stages.findIndex((stage) => stage.id === data.receiverPipelineStageId);

    /* move leads to new stage */
    const toBeMovePipelineStage = this.pipeline.sourcingPipeline.stages.find((stage) => stage.id === data.removePipelineStageId);

    console.log("toBeMovePipelineStage", toBeMovePipelineStage);
    this.pipeline.sourcingPipeline.stages.at(receiverPipelineStageIndex).leads = [
      ...this.pipeline.sourcingPipeline.stages.at(receiverPipelineStageIndex).leads,
      ...this.pipeline.sourcingPipeline.stages.at(toBeRemovePipelineStageIndex).leads,
    ];

    /* remove stage */
    this.pipeline.sourcingPipeline.stages.splice(toBeRemovePipelineStageIndex, 1);

    /* remove in stage id in drag n drop */
    const pipelineStageIdIndex = this.pipelineStageIds.findIndex((id) => id === data.removePipelineStageId);
    this.pipelineStageIds.splice(pipelineStageIdIndex, 1);
  }

  public onChangeStageLead(stageId: string, id: string, selected: boolean): void {
    this.pipeline.sourcingPipeline.stages.map((stage) => {
      stage.leads.map((lead) => {
        if (stage.id === stageId && lead.info._id === id) {
          lead.info.selected = selected;
        }
        return lead;
      });
      const selectedLeads = stage.leads.filter((lead) => lead.info.selected);
      if (stage.id === stageId) {
        stage.indeterminate = stage.id === stageId && selectedLeads.length !== stage.leads.length;
        stage.selected = stage.id === stageId && selectedLeads.length === stage.leads.length;

        if (selectedLeads.length === 0) {
          stage.selected = false;
          stage.indeterminate = false;
        }
      }
      return stage;
    });

    this.manageSelectedLeads();
  }

  public onSelectedLeadsToAdd(leadIds: Array<string>): void {
    lastValueFrom(
      this.studentsService.manage({
        action: "add-to-pipeline-with-pipeline-stage",
        pipeline: {
          pipelineIds: [this.pipelineId],
          pipelineStageId: this.selectedPipelineStageId,
        },
        leadIds: leadIds,
      })
    ).then((res) => {
      if (res.success) {
        this.updatePipeline(res.data);
        // this.nzMessageService.create(res.success ? "success" : "error", "Lead(s) was added");
      }
    });
  }

  public onActionSelector(type: TLeadSelectorAction): void {
    switch (type) {
      case "deselect-all":
      case "select-all":
        this.pipeline.sourcingPipeline.stages.forEach((stage) => {
          this.onChangeStage(stage.id, type === "deselect-all" ? false : true);
        });
        break;
      case "removed":
        this.pipeline.sourcingPipeline.stages.map((stage) => {
          const previousLeads = stage.leads;
          stage.leads = stage.leads.filter((lead) => !this.selectedLeadIds.includes(lead.info._id));
          if (previousLeads.length !== stage.leads.length) {
            stage.selected = false;
            stage.indeterminate = false;
          }
          return stage;
        });
        this.manageSelectedLeads();
        break;
      default:
        break;
    }
  }

  private manageSelectedLeads(): void {
    this.selectedLeadIds = [];
    this.pipeline.sourcingPipeline.stages.forEach((stage) => {
      stage.leads.forEach((lead) => {
        if (lead.info.selected) {
          this.selectedLeadIds.push(lead.info._id);
        }
      });
    });
  }

  private updatePipeline(pipeline: Pipeline): void {
    this.preloadedPipeline = pipeline;
    this.pipeline = pipeline;
    console.log("pipeline.sourcingPipeline", pipeline.sourcingPipeline);

    const items: Array<{ id: string; stageId?: string; name?: string; notes?: string }> = (pipeline as any).items ?? [];

    pipeline.sourcingPipeline.stages.map((stage) => {
      stage["selected"] = false;
      stage["indeterminate"] = false;

      if (this.pipelineType === "task") {
        // attach tasks to their stages based on stageId (backend task data shape)
        const tasksForStage =
          items
            .filter((item) => item.stageId === stage.id)
            .map((item) => {
              return {
                ...item,
                // keep a stable task identifier and use stage id as the mutable "id" used in the UI logic
                taskId: item.id,
                id: item.stageId ?? stage.id,
              } as any;
            }) || [];

        (stage as any).tasks = tasksForStage;
        stage.leads = [];
        stage.editable = true; // task pipeline stages are always shown in the single editable column
        return stage;
      }

      /* leads-based pipelines */
      if (!stage.leads) {
        stage.leads = [];
      }

      stage.leads.map((lead) => {
        console.log("lead", lead);
        if (!lead.info) {
          return lead;
        }
        lead.info["selected"] = false;

        const tags: any[] = [];
        if (Array.isArray(lead.info.tags)) {
          lead.info.tags.forEach((id: string) => {
            const tag = this.tags.find((t) => t._id === id);
            if (tag) {
              tags.push({ name: tag.value, color: tag.color });
            }
          }) as any;
        }

        lead.info.tags = tags;
        return lead;
      });

      return stage;
    });

    console.log("pipeline", pipeline.sourcingPipeline.stages);
    this.pipeline = pipeline;

    this.updatePipeStageIds();
  }

  private updatePipeStageIds(): void {
    this.pipelineStageIds = this.pipeline.sourcingPipeline.stages.map((p) => p.id);
  }

  public onClickViewLeadInfoModal(lead: PipelineLead, stage: PipelineStage): void {
    this.leadInfoModal.formGroup.get("pipelineId").setValue(this.pipeline._id);
    this.leadInfoModal.formGroup.get("pipelineStageId").setValue(stage.id);
    this.leadInfoModal.formGroup.get("leadId").setValue(lead.info._id);
    this.leadInfoModal.toggle();
  }

  public onEditStudent(id: string): void {
    this.studentInfoDrawer.studentId = id;
    this.studentInfoDrawer.toggle();
  }
}
