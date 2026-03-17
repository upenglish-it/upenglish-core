import { DatePipe, NgFor, NgIf } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IBranch, Task, TaskCategory } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { NGRXService, TasksService } from "@isms-core/services";
import { environment } from "@isms-env/environment";
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
import { AccountStore, BranchesStore } from "@isms-core/ngrx";
import { NzModalService } from "ng-zorro-antd/modal";
import { UploadTaskModalComponent } from "../upload-task-modal/upload-task-modal.component";
import { NzIconModule } from "ng-zorro-antd/icon";

@Component({
  selector: "isms-task-listing",
  templateUrl: "./task-listing.component.html",
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    NzTagModule,
    NzInputModule,
    NzDropDownModule,
    NzButtonModule,
    NzIconModule,
    NzCheckboxModule,
    NzToolTipModule,
    NzPopconfirmModule,
    ManageTaskModalComponent,
    UploadTaskModalComponent,
    ProfilePhotoDirective,
  ],
})
export class TaskListingComponent {
  @ViewChild("manageTaskModal") manageTaskModal: ManageTaskModalComponent;
  private subSink: SubSink = new SubSink();
  private tasks: Array<Task> = [];
  public filteredTasks: Array<Task> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });
  public selectedBranch: string = null;
  public branches: Array<IBranch> = [];

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly tasksService: TasksService,
    private readonly nzNotificationService: NzNotificationService,
    private readonly nzModalService: NzModalService,
    public readonly ngrxService: NGRXService,
    public readonly branchesStore: BranchesStore,
    public readonly accountStore: AccountStore
  ) {}

  public ngOnInit(): void {
    this.subSink.add(this.ngrxService.assignedBranches().subscribe((res) => (this.branches = res)));
    this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));

    this.loadData();
    this.subSink.add(
      this.filterFormGroup
        .get("searchQuery")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe((value) => {
          this.filteredTasks = this.find(this.tasks, value);
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
    return arr.filter((n: Task) => pa.every((p: { test: (arg0: string) => any }) => p.test(n.generalInfo.title)));
  }

  public async loadData(): Promise<void> {
    lastValueFrom(this.tasksService.fetch({ limit: 100 })).then((res) => {
      if (res.success) {
        this.tasks = res.data;
        this.filteredTasks = res.data;
      } else {
        this.resetTasks();
      }
    });
  }

  public onEdit(task: Task): void {
    if (task.status === "published") {
      this.router.navigate([task._id, "submissions"], { relativeTo: this.activatedRoute });
    } else {
      this.router.navigate([task._id, "builder"], { relativeTo: this.activatedRoute });
    }
  }

  public onDelete(id: string): void {
    lastValueFrom(this.tasksService.delete(id)).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Delete Task", res.message, { nzPlacement: "bottomRight" });
      this.loadData();
    });
  }

  public identify = (index: number, item: Task) => {
    return item._id;
  };

  public onSubmitted(value: Task): void {
    this.tasks.unshift(value);
    this.filteredTasks.unshift(value);
  }

  private resetTasks(): void {
    this.tasks = [];
    this.filteredTasks = [];
  }

  public totalPoints(categories: Array<TaskCategory>): number {
    return categories.reduce((pv, cv) => pv + cv.points, 0);
  }

  public copyToBranch(branchId: string, taskId: string): void {
    lastValueFrom(this.tasksService.copyToBranch(branchId, taskId)).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Copy to branch", res.message, { nzPlacement: "bottomRight" });
      this.loadData();
    });
  }

  public goToSuperLMS(): void {
    const url = `${environment.superLMS}/authenticate/verify?role=${this.accountStore.account.role}&email=${this.accountStore.account.emailAddresses[0]}`;
    window.open(url, "_blank").focus();
  }
}
