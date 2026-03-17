import { DatePipe, NgFor, NgIf, SlicePipe } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IAccount } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { NGRXService, StaffsService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { ExportJSONToCSVDirective, ProfilePhotoDirective } from "@isms-core/directives";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { StaffInfoDrawerComponent } from "@isms-core/components/staffs/staff-info-drawer/staff-info-drawer.component";
import { AddStaffManuallyModalComponent } from "../add-staff-manually-modal/add-staff-manually-modal.component";

@Component({
  selector: "isms-staff-listing",
  templateUrl: "./staff-listing.component.html",
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
    StaffInfoDrawerComponent,
    AddStaffManuallyModalComponent,
    ProfilePhotoDirective,
    ExportJSONToCSVDirective,
  ],
})
export class StaffListingComponent {
  @ViewChild("staffInfoDrawer") staffInfoDrawer: StaffInfoDrawerComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  private staffs: Array<IAccount> = [];
  public filteredStaffs: Array<IAccount> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });

  constructor(
    private readonly staffsService: StaffsService,
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
          this.filteredStaffs = this.find(this.staffs, value);
        })
    );

    // setTimeout(() => {
    //   this.onEdit("IS08076FB87B4B4FD5A252686EE95261D0"); // remove this later
    // }, 1000);
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
    this.filteredStaffs = [];
    this.staffs = [];
    const fetchResponse = await lastValueFrom(this.staffsService.fetch({ limit: 100 }));
    if (fetchResponse.success) {
      this.setStudents(fetchResponse.data);
    } else {
      this.resetStudents();
    }
  }
  public onEdit(id: string): void {
    this.staffInfoDrawer.staffId = id;
    this.staffInfoDrawer.toggle();
  }
  public identify = (index: number, item: IAccount) => {
    return item._id;
  };
  public onAllCandidateChecked(checked: boolean): void {
    console.log("checked", checked);
    this.filteredStaffs.map((student) => {
      student.selected = checked;
      return student;
    });
  }

  public onSubmitted(candidate: IAccount): void {
    // this.staffs.unshift(candidate);
    // this.filteredStaffs.unshift(candidate);
    this.loadData();
  }

  public onSmartFilterOutput(students: Array<IAccount>): void {
    if (students !== null) {
      this.setStudents(students);
    } else {
      this.loadData();
    }
  }
  private setStudents(students: Array<IAccount>): void {
    const mappedStudents = students.map((student) => {
      student["selected"] = false;
      return student;
    });
    this.staffs = mappedStudents;
    this.filteredStaffs = mappedStudents;
  }
  private resetStudents(): void {
    this.staffs = [];
    this.filteredStaffs = [];
  }

  // public onChangeSegmentSelector(index: number): void {
  //   this.segmentIndex = index;
  // }

  public get selectedStudents(): Array<string> {
    return this.staffs.filter((staff) => staff.selected).map((s) => s._id) || [];
  }
}
