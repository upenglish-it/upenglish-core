import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { ISegmentSelector, Task } from "@isms-core/interfaces";
import { TasksService, TasksSubjectService } from "@isms-core/services";
import { lastValueFrom } from "rxjs";
import { SubSink } from "subsink";

@Component({
  selector: "isms-builder-layout",
  templateUrl: "./layout.component.html",
  standalone: false,
})
export class LayoutComponent {
  private subSink = new SubSink();
  private taskId: string = null;
  public segmentOptions: Array<ISegmentSelector> = [
    { label: "Builder", icon: "ph-duotone ph-puzzle-piece", route: "builder" },
    { label: "Settings", icon: "ph-duotone ph-gear-six", route: "settings" },
    { label: "Submissions", icon: "ph-duotone ph-list-bullets", route: "submissions" },
  ];
  public segmentIndex = 0;
  public task: Task = null;

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly tasksService: TasksService,
    private readonly tasksSubjectService: TasksSubjectService
  ) {
    this.taskId = this.activatedRoute.snapshot.paramMap.get("taskId");
    console.log("this.activatedRoute.snapshot", this.activatedRoute.snapshot, this.taskId);
    this.segmentIndex = this.segmentOptions.findIndex((so) => this.router.url.includes(so.route));
  }

  public ngOnInit(): void {
    this.loadData();
  }

  public async loadData(): Promise<void> {
    lastValueFrom(this.tasksService.fetchById(this.taskId)).then((res) => {
      if (res.success) {
        this.task = res.data;
      }
    });

    this.subSink.add(
      this.tasksSubjectService.received().subscribe((value) => {
        console.log("receiveSettings>> ", value);
        if (value.type === "updated") {
          this.task = { ...value.data };
        }
      })
    );
  }

  public onChangeSegmentSelector(index: number): void {
    this.segmentIndex = index;
    const selected = this.segmentOptions.at(index);
    this.router.navigate([selected.route], { relativeTo: this.activatedRoute });
  }
}
