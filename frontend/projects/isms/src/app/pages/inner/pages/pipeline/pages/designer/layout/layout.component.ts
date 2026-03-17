import { Component, OnInit } from "@angular/core";
import { TabNavigations } from "./data";
import { ActivatedRoute, Event, NavigationEnd, Router } from "@angular/router";
import { lastValueFrom } from "rxjs";
import { PipelinesService } from "@isms-core/services/src/pipelines";
import { Pipeline } from "@isms-core/interfaces";

@Component({
  selector: "layout",
  templateUrl: "./layout.component.html",
  standalone: false,
})
export class LayoutComponent implements OnInit {
  public tabNavigations = TabNavigations;
  public pipelineId: string = null;
  public pipeline: Pipeline = null;
  public pipelineType: "leads" | "task" = "leads";

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly router: Router,
    private readonly pipelinesService: PipelinesService
  ) {
    const params = (this.activatedRoute.firstChild.params as any).value as { pipelineId: string; type?: "leads" | "task" };
    this.pipelineId = params.pipelineId;
    this.pipelineType = params.type || "leads";
  }
  public ngOnInit(): void {
    lastValueFrom(this.pipelinesService.fetchById(this.pipelineId, this.pipelineType)).then((res) => {
      res.success ? (this.pipeline = res.data) : (this.pipeline = null);
    });
  }
}
