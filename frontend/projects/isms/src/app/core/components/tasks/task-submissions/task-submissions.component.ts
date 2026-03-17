import { DatePipe, NgFor, NgIf, SlicePipe } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { ITag, TaskSubmission } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { TasksSubjectService, TasksSubmissionsService, TemplatesTagService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { ManageTaskModalComponent } from "../manage-task-modal/manage-task-modal.component";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { ActivatedRoute, Router } from "@angular/router";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { ReviewTaskSubmissionModalComponent } from "../review-task-submission-modal/review-task-submission-modal.component";
import { NzIconModule } from "ng-zorro-antd/icon";
import { AccountStore } from "@isms-core/ngrx";

@Component({
  selector: "isms-task-submissions",
  templateUrl: "./task-submissions.component.html",
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    SlicePipe,
    NzTagModule,
    NzInputModule,
    NzDropDownModule,
    NzButtonModule,
    NzCheckboxModule,
    NzToolTipModule,
    NzIconModule,
    NzPopconfirmModule,
    ReviewTaskSubmissionModalComponent,
    ProfilePhotoDirective,
  ],
})
export class TaskSubmissionsComponent {
  @ViewChild("reviewTaskSubmissionModal") reviewTaskSubmissionModal: ReviewTaskSubmissionModalComponent;
  private subSink: SubSink = new SubSink();
  private submissions: Array<TaskSubmission> = [];
  public filteredSubmissions: Array<TaskSubmission> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });
  public taskId: string = null;

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly tasksSubmissionsService: TasksSubmissionsService,
    private readonly templatesTagService: TemplatesTagService,
    private readonly nzNotificationService: NzNotificationService,
    public readonly accountStore: AccountStore
  ) {}

  public ngOnInit(): void {
    this.loadData();
    this.subSink.add(
      this.filterFormGroup
        .get("searchQuery")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe((value) => {
          this.filteredSubmissions = this.find(this.submissions, value);
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
    return arr.filter((n: TaskSubmission) => pa.every((p: { test: (arg0: string) => any }) => p.test(n.task.generalInfo.title)));
  }

  public async loadData(): Promise<void> {
    this.taskId = this.activatedRoute.parent.snapshot.paramMap.get("taskId");

    lastValueFrom(this.tasksSubmissionsService.fetchParticipantsSubmissions(this.taskId, { limit: 100 })).then((res) => {
      if (res.success) {
        this.setData(res.data);
      } else {
        this.resetData();
      }
    });
  }

  public onDelete(id: string): void {
    lastValueFrom(this.tasksSubmissionsService.delete(id)).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Delete Submission", res.message, { nzPlacement: "bottomRight" });
      this.loadData();
    });
  }

  public identify = (index: number, item: TaskSubmission) => {
    return item._id;
  };

  public onSubmitted(value: TaskSubmission): void {
    this.submissions.unshift(value);
    this.filteredSubmissions.unshift(value);
  }

  private setData(values: Array<TaskSubmission>): void {
    this.submissions = values;
    this.filteredSubmissions = values;
  }

  private resetData(): void {
    this.submissions = [];
    this.filteredSubmissions = [];
  }
}
