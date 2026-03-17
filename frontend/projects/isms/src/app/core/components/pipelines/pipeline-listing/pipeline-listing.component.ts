import { DatePipe, NgClass, NgFor, NgIf, SlicePipe } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { Pipeline, PipelineStatus } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { NGRXService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { AddNewPipelineModalComponent } from "../add-pipeline-modal/manage-pipeline-modal.component";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { Router, RouterModule } from "@angular/router";
import { PipelinesService } from "@isms-core/services/src/pipelines";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzSelectModule } from "ng-zorro-antd/select";
import { ClonePipelineModalComponent } from "../clone-pipeline-modal/clone-pipeline-modal.component";
import { NzModalModule, NzModalService } from "ng-zorro-antd/modal";

@Component({
  selector: "isms-pipeline-listing",
  templateUrl: "./pipeline-listing.component.html",
  imports: [
    NgIf,
    NgFor,
    NgClass,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    NzTagModule,
    NzInputModule,
    NzDropDownModule,
    NzButtonModule,
    NzCheckboxModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzModalModule,
    NzIconModule,
    RouterModule,
    AddNewPipelineModalComponent,
    ClonePipelineModalComponent,
  ],
})
export class PipelineListingComponent {
  @ViewChild("addPipelineModal") addPipelineModal: AddNewPipelineModalComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  private pipelines: Array<Pipeline> = [];
  public filteredPipelines: Array<Pipeline> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });

  constructor(
    private readonly router: Router,
    private readonly pipelinesService: PipelinesService,
    private readonly ngrxService: NGRXService,
    private readonly nzNotificationService: NzNotificationService,
    private readonly nzModalService: NzModalService
  ) {
    this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));
  }

  public ngOnInit(): void {
    this.loadData();
    this.subSink.add(
      this.filterFormGroup
        .get("searchQuery")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe((value) => {
          this.filteredPipelines = this.find(this.pipelines, value);
        })
    );
  }

  /* Temporary search filter. Refactor this later */
  private find(arr: any[], pat: string) {
    let pa = pat
      .trim()
      .replace(/ +/g, " ")
      .split(" ")
      .map((p: string | RegExp) => new RegExp(p, "i"));
    return arr.filter((n: { details: { title: string } }) => {
      let title = n.details.title;
      return pa.every((p: { test: (arg0: string) => any }) => p.test(title));
    });
  }

  public async loadData(): Promise<void> {
    lastValueFrom(this.pipelinesService.fetch()).then((res) => {
      if (res.success) {
        this.setPipelines(res.data);
      } else {
        this.resetPipelines();
      }
    });
  }

  public onAddCreated(pipeline: Pipeline): void {
    this.pipelines.unshift(pipeline);
  }

  public updateStatus(status: PipelineStatus, pipelineId: string): void {
    lastValueFrom(this.pipelinesService.updateStatus({ status: status }, pipelineId)).then();
  }

  public navigateTo(pipeline: Pipeline): void {
    const type = pipeline.type || "leads";
    let route = `/i/pipelines/designer/pipeline/${pipeline._id}/${type}`;
    if (pipeline.status === "inactive") {
      route = `/i/pipelines/designer/settings/${pipeline._id}/${type}`;
    }
    this.router.navigateByUrl(route);
  }

  public onDelete(pipelineId: string, index: number): void {
    const title = this.pipelines[index].details.title;
    const type = this.pipelines[index].type || "leads";
    this.nzModalService.confirm({
      nzBodyStyle: { "padding-left": "16px", "padding-right": "16px", "padding-bottom": "10px", "padding-top": "16px" },
      nzTitle: `Do you want to delete <span class="font-medium">${title}</span> pipeline?`,
      nzOkText: "Delete",
      nzOkType: "primary",
      nzOkDanger: true,
      nzCancelText: "No, Keep it",
      nzOnCancel: () => {},
      nzOnOk: () => {
        lastValueFrom(this.pipelinesService.delete(pipelineId, type)).then((res) => {
          if (res.success) {
            this.pipelines.splice(index, 1);
          }
        });
      },
    });
  }

  public identify = (index: number, item: Pipeline) => {
    return item._id;
  };

  public onSubmitted(value: Pipeline): void {
    this.pipelines.unshift(value);
    this.filteredPipelines.unshift(value);
  }

  private setPipelines(values: Array<Pipeline>): void {
    console.log("values", values);
    this.pipelines = values;
    this.filteredPipelines = values;
  }

  private resetPipelines(): void {
    this.pipelines = [];
    this.filteredPipelines = [];
  }
}
