import { NgClass, NgFor } from "@angular/common";
import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { SectionContainerComponent } from "@isms-core/components/common/section-container/section-container.component";
import { PipelineFormGroup, PipelineStageFormGroup } from "@isms-core/form-group";
import { Pipeline } from "@isms-core/interfaces";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { SourcingPipelineComponent } from "../sourcing-pipeline/sourcing-pipeline.component";
import { SourcingTeamComponent } from "../sourcing-team/sourcing-team.component";
import { PipelineDetailsComponent } from "../details/details.component";
import { debounceTime, lastValueFrom } from "rxjs";
import { SubSink } from "subsink";
import { PipelinesService } from "@isms-core/services/src/pipelines";

@Component({
  selector: "isms-pipeline-manage-info",
  templateUrl: "./manage-info.component.html",
  imports: [
    NgClass,
    NgFor,
    ReactiveFormsModule,
    NzModalModule,
    NzInputModule,
    NzSelectModule,
    NzDatePickerModule,
    NzButtonModule,
    NzDropDownModule,
    NzIconModule,
    NzDatePickerModule,
    NzToolTipModule,
    NzSwitchModule,
    NzInputNumberModule,
    SectionContainerComponent,
    PipelineDetailsComponent,
    SourcingPipelineComponent,
    SourcingTeamComponent,
  ],
})
export class PipelineManageInfoComponent implements OnInit, OnDestroy {
  public pipelineFormGroup: FormGroup = PipelineFormGroup();
  @Output("submit") private onSubmitEmitter: EventEmitter<void> = new EventEmitter<void>();
  private subSink: SubSink = new SubSink();
  private pipelineId: string = null;
  public pipelineType: "leads" | "task" = "leads";
  public pipeline: Pipeline;

  public publishingOptions: Array<any> = [
    {
      icon: "ph-globe-hemisphere-east",
      title: "Published",
      description: "Only sourcing team can edit. Candidate can view and apply the pipeline on your career site.",
      action: "published",
    },
    {
      icon: "ph-users",
      title: "Use Internally",
      description: "Only sourcing team can edit. The pipeline won't show on careers site. Candidates can view and apply pipeline with direct link.",
      action: "internal",
    },
    { icon: "ph-clipboard-text", title: "Save As Draft", description: "Only sourcing team can edit. Candidates can not view or apply the pipeline.", action: "draft" },
  ];

  public tabSectionOptions: Array<any> = [
    { icon: "ph-info", title: "Details", active: false, elementId: "details-section" },

    {
      icon: "ph-users-four",
      title: "Sourcing Team",
      active: false,
      elementId: "sourcing-team-section",
    },
    {
      icon: "ph-kanban",
      title: "Sourcing Pipeline",
      active: false,
      elementId: "sourcing-pipeline-section",
    },
  ];
  public selectedTabSectionIndex = 0;
  // public timezones: Array<ITimezone> = Timezones;
  // public countries: Array<ICountry> = Countries;
  // public currencies: Array<ICurrency> = Currencies;

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly pipelinesService: PipelinesService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {
    this.pipelineId = this.activatedRoute.snapshot.params["pipelineId"];
    this.pipelineType = (this.activatedRoute.snapshot.params["type"] as "leads" | "task") || "leads";

    lastValueFrom(this.pipelinesService.fetchById(this.pipelineId, this.pipelineType)).then((res) => {
      if (res.success) {
        this.setData(res.data);
      }
    });

    console.log("this.detailsFormGroup ", this.detailsFormGroup);

    this.detailsFormGroup.addControl("expand", new FormControl(true));
    // this.formSubmissionFormGroup.addControl("expand", new FormControl(true));
    this.sourcingPipelineFormGroup.addControl("expand", new FormControl(true));
    this.sourcingTeamFormGroup.addControl("expand", new FormControl(true));
    // this.shareSettingsFormGroup.addControl("expand", new FormControl(true));
    // this.onSelectSection(0);
    this.tabSectionOptions[0].active = true;

    this.subSink.add(
      this.pipelineFormGroup.valueChanges.pipe(debounceTime(1000)).subscribe((pipeline: Pipeline) => {
        console.log("changes", pipeline);

        lastValueFrom(this.pipelinesService.update(this.pipelineFormGroup.value, this.pipelineId)).then();
      })
    );
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  private setData(pipeline: Pipeline): void {
    this.pipeline = pipeline;

    this.pipelineFormGroup.get("_id").setValue(pipeline._id, { emitEvent: false });

    /* Set details */
    this.detailsFormGroup.setValue(
      {
        title: pipeline.details?.title || null,
        expand: true,
      },
      { emitEvent: false }
    );

    /* Set sourcing team */
    this.sourcingTeamFormGroup.setValue(
      {
        ownerId: pipeline.sourcingTeam?.ownerId || null,
        participantIds: pipeline.sourcingTeam?.participantIds || null,
        expand: true,
      },
      { emitEvent: false }
    );

    /* Set sourcing pipeline */
    // const stagesFormArray = this.sourcingPipelineFormGroup.get("stages") as FormArray;
    this.sourcingPipelineFormGroup.setValue({
      ...this.sourcingPipelineFormGroup.value,
      expand: true,
    });
    if (pipeline.sourcingPipeline?.stages) {
      const stagesFormArray = this.sourcingPipelineFormGroup.get("stages") as FormArray;

      pipeline.sourcingPipeline.stages.forEach((stage) => {
        const stageFormGroup = PipelineStageFormGroup();
        stageFormGroup.get("order").setValue(stage.order);
        stageFormGroup.get("state").setValue(stage.state);
        stageFormGroup.get("type").setValue(stage.type);
        stageFormGroup.get("title").setValue(stage.title);
        stageFormGroup.get("color").setValue(stage.color);
        stageFormGroup.get("id").setValue(stage.id);
        stageFormGroup.get("editable").setValue(stage.editable);
        stageFormGroup.get("won").setValue(stage.won);
        stagesFormArray.push(stageFormGroup);
      });
    }
  }

  public async onSubmit(): Promise<void> {
    this.pipelineFormGroup.markAllAsTouched();
    console.log("this.pipelineFormGroup", this.pipelineFormGroup);
    if (this.pipelineFormGroup.valid) {
      if (this.pipelineFormGroup.value._id) {
        // update
        const bulkUploadResponse = await lastValueFrom(
          this.pipelinesService.update(
            {
              title: this.pipelineFormGroup.value.title,
              description: this.pipelineFormGroup.value.description,
              type: this.pipelineFormGroup.value.type,
              closingDate: this.pipelineFormGroup.value.closingDate,
              quantity: this.pipelineFormGroup.value.quantity,
            },
            this.pipelineFormGroup.value._id
          )
        );
        const notificationTitle = "Update Pipeline Information";
        if (bulkUploadResponse.success) {
          this.nzNotificationService.success(notificationTitle, bulkUploadResponse.message, {
            nzPlacement: "bottomRight",
          });
          this.pipelineFormGroup.reset();
          this.onSubmitEmitter.emit();
          // this.router.navigateByUrl(`/i/candidates/bulk-upload/${bulkUploadResponse.data._id}`);
        } else {
          this.nzNotificationService.error(notificationTitle, bulkUploadResponse.message, {
            nzPlacement: "bottomRight",
          });
        }
      } else {
        const bulkUploadResponse = await this.pipelinesService
          .create({
            title: this.pipelineFormGroup.value.title,
            type: "leads",
          })
          .toPromise();
        const notificationTitle = "Create New Pipeline";
        if (bulkUploadResponse.success) {
          this.nzNotificationService.success(notificationTitle, bulkUploadResponse.message, {
            nzPlacement: "bottomRight",
          });
          this.pipelineFormGroup.reset();
          this.onSubmitEmitter.emit();
          // this.router.navigateByUrl(`/i/candidates/bulk-upload/${bulkUploadResponse.data._id}`);
        } else {
          this.nzNotificationService.error(notificationTitle, bulkUploadResponse.message, {
            nzPlacement: "bottomRight",
          });
        }
      }
    }
  }

  public async onCreate(): Promise<void> {
    console.log(JSON.stringify(this.pipelineFormGroup.value, null, 2));
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

  public toFormGroup(formGroup: AbstractControl): FormGroup {
    return formGroup as FormGroup;
  }

  public get detailsFormGroup(): FormGroup {
    return this.pipelineFormGroup.get("details") as FormGroup;
  }

  public get sourcingPipelineFormGroup(): FormGroup {
    return this.pipelineFormGroup.get("sourcingPipeline") as FormGroup;
  }

  public get sourcingTeamFormGroup(): FormGroup {
    return this.pipelineFormGroup.get("sourcingTeam") as FormGroup;
  }
}
