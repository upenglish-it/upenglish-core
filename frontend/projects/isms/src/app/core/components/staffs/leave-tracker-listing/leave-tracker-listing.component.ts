import { DatePipe, NgFor, NgIf, SlicePipe } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IAccount, ILeave, INameValue, TLeavesStatus } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { LeavesService, NGRXService, StaffsService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { ExportJSONToCSVDirective, ProfilePhotoDirective } from "@isms-core/directives";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { StaffInfoDrawerComponent } from "@isms-core/components/staffs/staff-info-drawer/staff-info-drawer.component";
import { AddStaffManuallyModalComponent } from "../add-staff-manually-modal/add-staff-manually-modal.component";
import { NzSelectModule } from "ng-zorro-antd/select";
import { LeaveStatus, LeaveTypes } from "@isms-core/constants";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { DateTime, Interval } from "luxon";
import { ManageLeaveApprovalModalComponent } from "../manage-leave-approval-modal/manage-leave-approval-modal.component";

@Component({
  selector: "isms-leave-tracker-listing",
  templateUrl: "./leave-tracker-listing.component.html",
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
    NzIconModule,
    NzSelectModule,
    NzToolTipModule,
    NzButtonModule,
    NzCheckboxModule,
    StaffInfoDrawerComponent,
    AddStaffManuallyModalComponent,
    ManageLeaveApprovalModalComponent,
    ProfilePhotoDirective,
    ExportJSONToCSVDirective,
  ],
})
export class LeaveTrackerListingComponent {
  @ViewChild("staffInfoDrawer") staffInfoDrawer: StaffInfoDrawerComponent;
  @ViewChild("manageLeaveApprovalModal") manageLeaveApprovalModal: ManageLeaveApprovalModalComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  public leaveTypes: Array<INameValue> = LeaveTypes;
  public leaveStatus: Array<INameValue> = LeaveStatus;
  private leaves: Array<ILeave> = [];
  public filteredLeaves: Array<ILeave> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });

  constructor(
    private readonly leavesService: LeavesService,
    private readonly ngrxService: NGRXService
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
          this.filteredLeaves = this.find(this.leaves, value);
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
    return arr.filter((n: { firstName: string; lastName: string }) => {
      let name = n.firstName + " " + n.lastName;
      return pa.every((p: { test: (arg0: string) => any }) => p.test(name));
    });
  }
  public async loadData(): Promise<void> {
    const staffRequest = await lastValueFrom(this.leavesService.fetchStaff({ limit: 100 }));
    if (staffRequest.success) {
      this.setData(staffRequest.data);
    } else {
      this.resetData();
    }
  }

  public actionRequest(leave: ILeave, status: TLeavesStatus): void {
    this.manageLeaveApprovalModal.leaveApprovalFormGroup.get("leaveId").setValue(leave._id);
    this.manageLeaveApprovalModal.leaveApprovalFormGroup.get("status").setValue(status);
    this.manageLeaveApprovalModal.leaveApprovalFormGroup.get("notes").reset();
    this.manageLeaveApprovalModal.toggle();
  }

  public identify = (index: number, item: ILeave) => {
    return item._id;
  };

  public onAllCandidateChecked(checked: boolean): void {
    this.filteredLeaves.map((data) => {
      data.selected = checked;
      return data;
    });
  }

  public onSubmitted(item: ILeave): void {
    this.leaves.unshift(item);
    this.filteredLeaves.unshift(item);
  }

  public onSmartFilterOutput(items: Array<ILeave>): void {
    if (items !== null) {
      this.setData(items);
    } else {
      this.loadData();
    }
  }

  private setData(items: Array<ILeave>): void {
    const mappedItems = items.map((item) => {
      item["selected"] = false;
      const startDate = DateTime.fromISO(item.dates.at(0).date);
      const toDate = DateTime.fromISO(item.dates.at(-1).date);
      item["totalDaysOfLeave"] = Math.round(Interval.fromDateTimes(startDate, toDate).toDuration("days").days);
      return item;
    });
    this.leaves = mappedItems;
    this.filteredLeaves = mappedItems;
  }

  private resetData(): void {
    this.leaves = [];
    this.filteredLeaves = [];
  }

  // public onChangeSegmentSelector(index: number): void {
  //   this.segmentIndex = index;
  // }

  public get selectedItems(): Array<string> {
    return this.leaves.filter((leave) => leave.selected).map((s) => s._id) || [];
  }
}
