import { NgClass, NgFor, NgIf } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { FormArray } from "@angular/forms";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { AttendeeFormGroup } from "@isms-core/form-group";
import { IAccount, ICalendarEventAttendee } from "@isms-core/interfaces";
import { StaffsService } from "@isms-core/services";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { lastValueFrom } from "rxjs";

@Component({
  selector: "isms-members-selector",
  templateUrl: "./members-selector.component.html",
  imports: [NgIf, NgFor, NgClass, NzInputModule, NzIconModule, NzSelectModule, NzDropDownModule, NzButtonModule, NzToolTipModule, NzPopconfirmModule, ProfilePhotoDirective],
})
export class MembersSelectorComponent implements OnInit {
  @Input("attendees-form-array") attendeesFormArray: FormArray = new FormArray([]);
  private staffs: Array<IAccount> = [];
  public filteredStaffs: Array<IAccount> = [];
  public searchAttendeesDropdown: boolean = false;

  constructor(private readonly staffsService: StaffsService) {}

  public ngOnInit(): void {
    lastValueFrom(this.staffsService.fetch()).then((res) => {
      this.staffs = res.success ? res.data : [];
      this.filteredStaffs = this.staffs;
    });
  }

  public manageStaffs(): void {
    const attendeeEmailAddresses: Array<string> = this.attendeesFormArray.value.map((attendee: ICalendarEventAttendee) => attendee.emailAddress);
    console.log("attendeeEmailAddresses", attendeeEmailAddresses);

    this.filteredStaffs = this.staffs.filter((staff) => !attendeeEmailAddresses.includes(staff.emailAddresses[0]));

    console.log("this.filteredStaffs", this.filteredStaffs);
  }

  public onSelectStaff(staff: IAccount): void {
    const attendeeEmailAddresses: Array<string> = this.attendeesFormArray.value.map((attendee: ICalendarEventAttendee) => attendee.emailAddress);
    const isExist = attendeeEmailAddresses.includes(staff.emailAddresses[0]);
    if (!isExist) {
      const attendeeFormGroup = AttendeeFormGroup();
      attendeeFormGroup.setValue({
        accountId: staff._id,
        emailAddress: staff.emailAddresses[0].toLowerCase(),
        name: `${staff.firstName} ${staff.lastName}`,
        required: false,
        response: "none",
        profilePhoto: `${staff.firstName[0]}${staff.lastName[0]}`.toLowerCase(),
      });
      this.attendeesFormArray.push(attendeeFormGroup);
    }
  }
}
