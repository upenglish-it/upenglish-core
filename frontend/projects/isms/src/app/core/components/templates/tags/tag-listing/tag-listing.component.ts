import { DatePipe, NgFor, NgIf, NgStyle, SlicePipe } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { ITag } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { TemplatesTagService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { ExportJSONToCSVDirective, ProfilePhotoDirective } from "@isms-core/directives";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { ManageTagModalComponent } from "../manage-tag-modal/manage-tag-modal.component";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { DaysToStringFormatPipe } from "@isms-core/pipes";

@Component({
  selector: "isms-tag-listing",
  templateUrl: "./tag-listing.component.html",
  imports: [
    NgIf,
    NgFor,
    NgStyle,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    SlicePipe,
    NzTagModule,
    NzInputModule,
    NzDropDownModule,
    NzButtonModule,
    NzCheckboxModule,
    NzPopconfirmModule,
    ManageTagModalComponent,
    DaysToStringFormatPipe,
    ProfilePhotoDirective,
    ExportJSONToCSVDirective,
  ],
})
export class TagListingComponent {
  @ViewChild("manageTagModal") manageTagModal: ManageTagModalComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  private tags: Array<ITag> = [];
  public filteredTags: Array<ITag> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });

  constructor(
    private readonly templatesTagService: TemplatesTagService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {
    this.loadData();
    this.subSink.add(
      this.filterFormGroup
        .get("searchQuery")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe((value) => {
          this.filteredTags = this.find(this.tags, value);
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
    lastValueFrom(this.templatesTagService.fetch({ limit: 100 })).then((res) => {
      if (res.success) {
        this.setStudents(res.data);
      } else {
        this.resetStudents();
      }
    });
  }

  public onEdit(id: string): void {
    this.manageTagModal.tagId = id;
    this.manageTagModal.toggle();
  }

  public onDelete(id: string): void {
    lastValueFrom(this.templatesTagService.delete(id)).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Delete Tag", res.message, { nzPlacement: "bottomRight" });
      this.loadData();
    });
  }

  public identify = (index: number, item: ITag) => {
    return item._id;
  };

  public onSubmitted(value: ITag): void {
    this.tags.unshift(value);
    this.filteredTags.unshift(value);
  }

  private setStudents(values: Array<ITag>): void {
    this.tags = values;
    this.filteredTags = values;
  }

  private resetStudents(): void {
    this.tags = [];
    this.filteredTags = [];
  }
}
