import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from "@angular/core";
import { FormArray, FormControl, FormGroup, FormsModule, Validators } from "@angular/forms";
import { Animations } from "@isms-core/constants";
import { IAccount, IGroup, ISegmentSelector } from "@isms-core/interfaces";
// import { GroupService } from "@isms-core/services";
import { GroupComponent } from "./group/group.component";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { CourseFilterComponent } from "./course-filter/course-filter.component";
import { NzPopoverModule } from "ng-zorro-antd/popover";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NgFor, NgIf } from "@angular/common";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { SmartFilterComponent } from "./smart-filter/smart-filter.component";
import { SmartFilterStudentsService } from "@isms-core/services";
import { lastValueFrom } from "rxjs";
import { ISmartFilterStudent } from "@isms-core/interfaces/src/smart-filters";
import { AddTagsModalComponent } from "../add-tags/add-tags.component";
import { AddSourcesModalComponent } from "../add-sources/add-sources.component";

@Component({
  selector: "isms-manage-student-filter",
  templateUrl: "./manage-student-filter.component.html",
  animations: [Animations.default],
  imports: [
    NgIf,
    NgFor,
    FormsModule,
    NzButtonModule,
    NzToolTipModule,
    NzToolTipModule,
    NzPopoverModule,
    NzInputModule,
    NzCheckboxModule,
    NzIconModule,
    SegmentedSelectorComponent,
    GroupComponent,
    CourseFilterComponent,
    SmartFilterComponent,
    AddTagsModalComponent,
    AddSourcesModalComponent,
  ],
})
export class ManageStudentFilterComponent implements OnInit {
  @Input("student-ids") studentIds: Array<string> = [];
  @Output("on-smart-filter-output") onSmartFilterOutput: EventEmitter<Array<IAccount>> = new EventEmitter<Array<IAccount>>();
  @ViewChild("smartFilter") smartFilter: SmartFilterComponent;
  @ViewChild("group") group: GroupComponent;
  public groupFormGroup: FormGroup;
  public groupingAndSmartFilterSegment: Array<ISegmentSelector> = [
    // {
    //   label: "Classes",
    //   icon: "ph-duotone ph-folders",
    //   disable: false
    // },
    // {
    //   label: "Courses",
    //   icon: "ph-duotone ph-chalkboard",
    //   disable: false
    // },
    // {
    //   label: "Groups",
    //   icon: "ph-duotone ph-folders",
    //   disable: false
    // },
    {
      label: "Smart Filter",
      icon: "ph-duotone ph-funnel",
      disable: false,
    },
  ];
  public segmentIndex = 0;
  public showGrouping = true;
  public showSmartFilter = true;
  public popoverVisible = false;
  public groups: Array<IGroup> = [];
  public smartFilterStudents: Array<ISmartFilterStudent> = [];

  public filterOutputFormGroup: FormGroup = new FormGroup({
    selectedSmartFilter: new FormArray([]),
  });

  constructor(private readonly smartFilterStudentsService: SmartFilterStudentsService) {}

  public ngOnInit(): void {
    this.loadSmartFilterData();
    this.initializeFormGroup();
  }

  public initializeFormGroup(): void {
    this.groupFormGroup = new FormGroup({
      _id: new FormControl(null),
      name: new FormControl(null, [Validators.required]),
      subGroup: new FormArray([]),
    });
  }

  public loadSmartFilterData(): void {
    /* load smart filters */
    lastValueFrom(this.smartFilterStudentsService.fetch()).then((res) => {
      if (res.success) {
        this.smartFilterStudents = res.data.map((sf: ISmartFilterStudent) => {
          sf["selected"] = false;
          return sf;
        });
      }
    });
  }

  public onChangeSegmentSelector(index: number): void {
    this.segmentIndex = index;
  }

  public groupingChange(event: any): void {}

  public onConfigure(group: IGroup): void {
    this.groupFormGroup.get("_id").setValue(group._id);
    this.groupFormGroup.get("name").setValue(group.name);

    for (const subGroup of group.subGroup) {
      (this.groupFormGroup.get("subGroup") as FormArray).push(
        new FormGroup({
          _id: new FormControl(subGroup._id),
          name: new FormControl(subGroup.name, [Validators.required]),
        })
      );
    }
    this.group.toggle();
  }

  public onConfigureSmartFilter(smartFilter: ISmartFilterStudent): void {
    this.smartFilter.smartFilterId = smartFilter._id;
    this.smartFilter.toggle();
  }

  public onSmartCheckChange(checked: boolean, id: string): void {
    if (checked) {
      this.selectedSmartFilterFormArray.push(new FormControl(id));
    } else {
      const idIndex = (this.selectedSmartFilterFormArray.value as Array<string>).findIndex((value) => value === id);
      if (idIndex !== -1) {
        this.selectedSmartFilterFormArray.removeAt(idIndex);
      }
    }
    if (this.selectedSmartFilterFormArray.length > 0) {
      lastValueFrom(this.smartFilterStudentsService.fetchFilterResult(this.selectedSmartFilterFormArray.value)).then((res) => {
        this.onSmartFilterOutput.emit(res.success ? res.data : []);
      });
    } else {
      this.onSmartFilterOutput.emit(null);
    }
  }

  private get selectedSmartFilterFormArray(): FormArray {
    return this.filterOutputFormGroup.get("selectedSmartFilter") as FormArray;
  }
}
