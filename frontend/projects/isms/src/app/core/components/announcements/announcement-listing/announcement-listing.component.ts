import { DatePipe, NgFor, NgIf } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IAnnouncement } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { AnnouncementsService, NGRXService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { ManageAnnouncementModalComponent } from "../manage-announcement-modal/manage-announcement-modal.component";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzIconModule } from "ng-zorro-antd/icon";
import { AccountStore } from "@isms-core/ngrx";

@Component({
  selector: "isms-announcement-listing",
  templateUrl: "./announcement-listing.component.html",
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    NzTagModule,
    NzInputModule,
    NzIconModule,
    NzDropDownModule,
    NzButtonModule,
    NzCheckboxModule,
    NzPopconfirmModule,
    ManageAnnouncementModalComponent,
  ],
})
export class AnnouncementListingComponent {
  @ViewChild("manageAnnouncementModal") manageAnnouncementModal: ManageAnnouncementModalComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  private announcements: Array<IAnnouncement> = [];
  public filteredAnnouncements: Array<IAnnouncement> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });

  constructor(
    public readonly accountStore: AccountStore,
    private readonly announcementsService: AnnouncementsService,
    private readonly ngrxService: NGRXService,
    private readonly nzNotificationService: NzNotificationService
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
          this.filteredAnnouncements = this.find(this.announcements, value);
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
    return arr.filter((n: { title: string }) => {
      let title = n.title;
      return pa.every((p: { test: (arg0: string) => any }) => p.test(title));
    });
  }

  public async loadData(): Promise<void> {
    lastValueFrom(this.announcementsService.fetch({ limit: 100 })).then((res) => {
      if (res.success) {
        this.setStudents(res.data);
      } else {
        this.resetStudents();
      }
    });
  }

  public onEdit(id: string): void {
    this.manageAnnouncementModal.announcementId = id;
    this.manageAnnouncementModal.toggle();
  }

  public onDelete(id: string): void {
    lastValueFrom(this.announcementsService.delete(id)).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Delete", res.message, { nzPlacement: "bottomRight" });
      this.loadData();
    });
  }

  public onApprove(id: string): void {
    lastValueFrom(this.announcementsService.verify(id)).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Verify", res.message, { nzPlacement: "bottomRight" });
      this.loadData();
    });
  }

  public identify = (index: number, item: IAnnouncement) => {
    return item._id;
  };

  public onSubmitted(value: IAnnouncement): void {
    this.announcements.unshift(value);
    this.filteredAnnouncements.unshift(value);
  }

  private setStudents(values: Array<IAnnouncement>): void {
    this.announcements = values;
    this.filteredAnnouncements = values;
  }

  private resetStudents(): void {
    this.announcements = [];
    this.filteredAnnouncements = [];
  }
}
