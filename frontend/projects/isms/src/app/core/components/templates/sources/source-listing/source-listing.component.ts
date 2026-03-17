import { DatePipe, NgFor, NgIf, SlicePipe } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { ISource } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { TemplatesSourceService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { ExportJSONToCSVDirective, ProfilePhotoDirective } from "@isms-core/directives";
import { NzInputModule } from "ng-zorro-antd/input";
import { ManageSourceModalComponent } from "../manage-source-modal/manage-source-modal.component";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { DaysToStringFormatPipe } from "@isms-core/pipes";

@Component({
  selector: "isms-source-listing",
  templateUrl: "./source-listing.component.html",
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    SlicePipe,
    NzInputModule,
    NzDropDownModule,
    NzButtonModule,
    NzPopconfirmModule,
    ManageSourceModalComponent,
    DaysToStringFormatPipe,
    ProfilePhotoDirective,
    ExportJSONToCSVDirective,
  ],
})
export class SourceListingComponent {
  @ViewChild("manageSourceModal") manageSourceModal: ManageSourceModalComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  private sources: Array<ISource> = [];
  public filteredSources: Array<ISource> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });

  constructor(
    private readonly templatesSourceService: TemplatesSourceService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {
    this.loadData();
    this.subSink.add(
      this.filterFormGroup
        .get("searchQuery")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe((value) => {
          this.filteredSources = this.find(this.sources, value);
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
    return arr.filter((n: { name: string }) => {
      let name = n.name;
      return pa.every((p: { test: (arg0: string) => any }) => p.test(name));
    });
  }

  public async loadData(): Promise<void> {
    lastValueFrom(this.templatesSourceService.fetch({ limit: 100 })).then((res) => {
      if (res.success) {
        this.setStudents(res.data);
      } else {
        this.resetStudents();
      }
    });
  }

  public onEdit(id: string): void {
    this.manageSourceModal.sourceId = id;
    this.manageSourceModal.toggle();
  }

  public onDelete(id: string): void {
    lastValueFrom(this.templatesSourceService.delete(id)).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Delete Source", res.message, { nzPlacement: "bottomRight" });
      this.loadData();
    });
  }

  public identify = (index: number, item: ISource) => {
    return item._id;
  };

  public onSubmitted(value: ISource): void {
    this.sources.unshift(value);
    this.filteredSources.unshift(value);
  }

  private setStudents(values: Array<ISource>): void {
    this.sources = values;
    this.filteredSources = values;
  }

  private resetStudents(): void {
    this.sources = [];
    this.filteredSources = [];
  }
}
