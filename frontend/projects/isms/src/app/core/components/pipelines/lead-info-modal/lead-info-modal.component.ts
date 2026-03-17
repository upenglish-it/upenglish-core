import { NgClass, NgFor, NgIf } from "@angular/common";
import { Component, EventEmitter, OnInit, Output, ViewChild } from "@angular/core";
import { AbstractControl, FormArray, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { NoteLogComponent } from "@isms-core/components/activity/note-log/note-log.component";
import { PipelinesActivityLogsService, PipelinesConversationsService, PipelinesNotesService, PipelinesService } from "@isms-core/services/src/pipelines";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzStepsModule } from "ng-zorro-antd/steps";
import { NzDescriptionsModule } from "ng-zorro-antd/descriptions";
import { lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzBadgeModule } from "ng-zorro-antd/badge";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { IAccount, ISegmentSelector, PipelineActivityLog, PipelineConversation, PipelineLeadInfo, PipelineNote } from "@isms-core/interfaces";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { AddNoteModalComponent } from "@isms-core/components/activity/add-note-modal/add-note-modal.component";
import { isEmpty } from "lodash";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { AddConversationModalComponent } from "@isms-core/components/activity/add-conversation-modal/add-conversation-modal.component";
import { ConversationItemComponent } from "@isms-core/components/activity/conversation-item/conversation-item.component";
import { ActivityLogItemComponent } from "@isms-core/components/activity/activity-log-item/activity-log-item.component";
import { StaffsService } from "@isms-core/services";
import { NzSelectModule } from "ng-zorro-antd/select";

@Component({
  selector: "isms-lead-info-modal",
  templateUrl: "./lead-info-modal.component.html",
  imports: [
    NgIf,
    NgFor,
    NgClass,
    ReactiveFormsModule,
    FormsModule,
    NzModalModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
    NzTagModule,
    NzDescriptionsModule,
    NzStepsModule,
    NzBadgeModule,
    NzIconModule,
    NzEmptyModule,
    NzSelectModule,
    ProfilePhotoDirective,
    SegmentedSelectorComponent,
    NoteLogComponent,
    AddNoteModalComponent,
    AddConversationModalComponent,
    ConversationItemComponent,
    ActivityLogItemComponent,
  ],
})
export class LeadInfoModalComponent implements OnInit {
  @ViewChild("addNoteModal") public readonly addNoteModal: AddNoteModalComponent;
  @ViewChild("addConversationModal") public readonly addConversationModal!: AddConversationModalComponent;
  public formGroup: FormGroup = new FormGroup({
    leadId: new FormControl(null, [Validators.required]),
    pipelineId: new FormControl(null, [Validators.required]),
    pipelineStageId: new FormControl(null, [Validators.required]),
  });
  @Output("on-submit") private onSubmitEmitter: EventEmitter<void> = new EventEmitter<void>();
  public showModal: boolean = false;
  public currentPipelineStageIndex: number = 0;
  public middleSegmentIndex: number = 0;
  public middleSegmentOptions: Array<ISegmentSelector> = [
    {
      label: "Activity Logs",
      icon: "ph-duotone ph-list-bullets",
      disable: false,
    },
    {
      label: "Conversations",
      icon: "ph-duotone ph-chats-circle",
      disable: false,
    },
  ];

  public rightSegmentIndex: number = 0;
  public rightSegmentOptions: Array<ISegmentSelector> = [
    {
      label: "Notes",
      icon: "ph-duotone ph-file-text",
      disable: false,
    },
    {
      label: "Pipeline Stages",
      icon: "ph-duotone ph-kanban",
      disable: false,
    },
  ];

  public activityLogsFormArray: FormArray = new FormArray([]);
  public notesFormArray: FormArray = new FormArray([]);
  public conversationsFormArray: FormArray = new FormArray([]);
  public leadInfo: PipelineLeadInfo = null;
  public staffs: Array<IAccount> = [];

  constructor(
    private readonly router: Router,
    private readonly pipelinesService: PipelinesService,
    private readonly pipelinesNotesService: PipelinesNotesService,
    private readonly pipelinesConversationsService: PipelinesConversationsService,
    private readonly pipelinesActivityLogsService: PipelinesActivityLogsService,
    private readonly nzNotificationService: NzNotificationService,
    private readonly staffsService: StaffsService
  ) {}

  public ngOnInit(): void {
    this.formGroup.get("leadId").valueChanges.subscribe((value) => {
      this.leadInfo = null;
      if (!isEmpty(value)) {
        lastValueFrom(this.pipelinesService.fetchLeadInfo(this.formGroup.value.pipelineId, { leadId: value })).then((res) => {
          this.leadInfo = res.success ? res.data : null;

          this.currentPipelineStageIndex = this.leadInfo.pipeline.sourcingPipeline.stages.findIndex((stage) => stage.id === this.leadInfo.currentPipelineStage.id);

          const timer = setTimeout(() => {
            this.addConversationModal.formGroup.get("leadId").setValue(this.formGroup.value.leadId);
            this.addConversationModal.formGroup.get("pipelineId").setValue(this.formGroup.value.pipelineId);
            this.addConversationModal.formGroup.get("pipelineStageId").setValue(this.formGroup.value.pipelineStageId);
            clearTimeout(timer);
          }, 500);
        });
      }
    });

    lastValueFrom(this.staffsService.fetch({ includeMe: true })).then((res) => {
      if (res.success) {
        const staffs: Array<IAccount> = res.data;
        this.staffs = staffs.filter((staff) => staff.role === "marketing" || staff.role === "receptionist" || "admmin");
      }
    });
  }

  public toggle(): void {
    this.showModal = !this.showModal;
    if (this.showModal) {
      this.loadNotes();
      this.loadConversations();
      this.loadActivityLogs();
    }
  }

  public toFormGroup(formGroup: AbstractControl): FormGroup {
    return formGroup as FormGroup;
  }

  public loadNotes(): void {
    this.notesFormArray.clear();
    lastValueFrom(this.pipelinesNotesService.fetch(this.formGroup.value.pipelineId, this.formGroup.value.leadId)).then((res) => {
      if (res.success) {
        (res.data as Array<PipelineNote>).forEach((note) => {
          this.notesFormArray.push(
            new FormGroup({
              expand: new FormControl(true),
              title: new FormControl(note.title),
              message: new FormControl(note.message),
              createdBy: new FormControl(`${note.createdBy.firstName} ${note.createdBy.lastName}`),
              createdAt: new FormControl(note.createdAt),
            })
          );
        });
      }
    });
  }

  public loadConversations(): void {
    this.conversationsFormArray.clear();
    lastValueFrom(this.pipelinesConversationsService.fetch(this.formGroup.value.pipelineId, this.formGroup.value.leadId)).then((res) => {
      if (res.success) {
        (res.data as Array<PipelineConversation>).forEach((conversation) => {
          this.conversationsFormArray.push(
            new FormGroup({
              expand: new FormControl(true),
              message: new FormControl(conversation.message),
              createdBy: new FormControl(`${conversation.createdBy.firstName} ${conversation.createdBy.lastName}`),
              createdAt: new FormControl(conversation.createdAt),
            })
          );
        });
      }
    });
  }

  public loadActivityLogs(): void {
    this.activityLogsFormArray.clear();
    lastValueFrom(this.pipelinesActivityLogsService.fetch(this.formGroup.value.pipelineId, this.formGroup.value.leadId)).then((res) => {
      if (res.success) {
        (res.data as Array<PipelineActivityLog>).forEach((activity) => {
          let message = null;

          if (activity.type === "add-note") {
            message = `${activity.createdBy.firstName} ${activity.createdBy.lastName} added a note`;
          }

          if (activity.type === "assign-to-stage") {
            message = `${activity.createdBy.firstName} ${activity.createdBy.lastName} move the lead to ${activity.message} stage`;
          }

          this.activityLogsFormArray.push(
            new FormGroup({
              expand: new FormControl(true),
              message: new FormControl(message),
              createdBy: new FormControl(`${activity.createdBy.firstName} ${activity.createdBy.lastName} `),
              createdAt: new FormControl(activity.createdAt),
            })
          );
        });
      }
    });
  }

  public onChangeMiddleSegmentSelector(index: number): void {
    this.middleSegmentIndex = index;
  }

  public onChangeRightSegmentSelector(index: number): void {
    this.rightSegmentIndex = index;
  }

  public async onSubmit(): Promise<void> {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.valid) {
      lastValueFrom(this.pipelinesService.create({ title: this.formGroup.value.title, type: "leads" })).then((res) => {
        if (res.success) {
          this.toggle();
          this.formGroup.reset();
          this.onSubmitEmitter.emit();
          this.router.navigateByUrl(`/i/pipeline/designer/settings/${res.data._id}`);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Add New Pipeline", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }

  public onClickAddNote(): void {
    this.addNoteModal.formGroup.get("leadIds").setValue([this.formGroup.value.leadId]);
    this.addNoteModal.formGroup.get("pipelineId").setValue(this.formGroup.value.pipelineId);
    this.addNoteModal.formGroup.get("pipelineStageId").setValue(this.formGroup.value.pipelineStageId);
    this.addNoteModal.toggle();
  }
}
