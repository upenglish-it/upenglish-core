import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { Component, EventEmitter, OnInit, Output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { LeavesService, SchedulesShiftsService } from "@isms-core/services";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzSelectModule } from "ng-zorro-antd/select";
import { lastValueFrom } from "rxjs";

@Component({
  selector: "isms-manage-leave-approval-modal",
  templateUrl: "./manage-leave-approval-modal.component.html",
  standalone: true,
  imports: [NgIf, NgFor, JsonPipe, ReactiveFormsModule, NzModalModule, NzInputModule, NzButtonModule, NzIconModule, NzDatePickerModule, NzSelectModule],
})
export class ManageLeaveApprovalModalComponent implements OnInit {
  @Output("on-submitted") onSubmitted: EventEmitter<void> = new EventEmitter<void>();
  public showDrawer: boolean = false;
  public loading: boolean = false;

  public leaveApprovalFormGroup: FormGroup = new FormGroup({
    leaveId: new FormControl(null, Validators.required),
    status: new FormControl(null, Validators.required),
    notes: new FormControl(null, Validators.required),
  });

  constructor(
    private readonly nzNotificationService: NzNotificationService,
    private readonly leavesService: LeavesService,
    private readonly schedulesShiftsService: SchedulesShiftsService
  ) {}

  public ngOnInit(): void {}

  public toggle(): void {
    this.showDrawer = !this.showDrawer;
  }

  public onSubmit(): void {
    this.loading = true;
    lastValueFrom(this.leavesService.actionRequest(this.leaveApprovalFormGroup.value)).then((res) => {
      this.loading = false;
      if (res.success) {
        this.toggle();
        this.onSubmitted.emit();
        this.nzNotificationService.create(res.success ? "success" : "error", "Leave Approval", res.message);
      }
    });
  }
}
