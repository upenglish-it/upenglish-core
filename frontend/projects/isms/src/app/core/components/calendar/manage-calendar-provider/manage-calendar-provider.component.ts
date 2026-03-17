import { NgClass, NgFor, NgIf } from "@angular/common";
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormArray, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { MembersSelectorComponent } from "@isms-core/components/common/members-selector/members-selector.component";
import { ScheduleSelectorComponent } from "@isms-core/components/common/schedule-selector/schedule-selector.component";
import { Animations } from "@isms-core/constants";
import { ScheduleFormGroup } from "@isms-core/form-group";
import { IIntegration } from "@isms-core/interfaces";
import { CalendarsService, MicrosoftCalendarService } from "@isms-core/services";
import { isEmpty } from "lodash";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzSpinModule } from "ng-zorro-antd/spin";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { lastValueFrom } from "rxjs";

@Component({
  selector: "isms-manage-calendar-provider",
  templateUrl: "./manage-calendar-provider.component.html",
  animations: [Animations.down],
  imports: [
    NgIf,
    NgFor,
    NgClass,
    FormsModule,
    ReactiveFormsModule,
    NzModalModule,
    NzButtonModule,
    NzInputModule,
    NzCheckboxModule,
    NzSpinModule,
    NzToolTipModule,
    NzSwitchModule,
    NzIconModule,
    ScheduleSelectorComponent,
    MembersSelectorComponent,
  ],
})
export class ManageCalendarProviderComponent implements OnInit {
  @Input("integration") integration: IIntegration;
  @Input("integration-index") integrationIndex: number;
  @Output("on-collapse") onCollapse: EventEmitter<boolean> = new EventEmitter();
  @Output("on-checked-calendars") onCheckedCalendars: EventEmitter<Array<{ id: string; show: boolean }>> = new EventEmitter();
  @Output("on-submitted") onSubmitted: EventEmitter<void> = new EventEmitter();
  @Output("on-deleted") onDeleted: EventEmitter<void> = new EventEmitter();

  public integrationFormGroup = new FormGroup({
    sync: new FormControl(false, Validators.required),
  });
  public showModal: boolean = false;
  public syncLoading: boolean = false;
  public unlinkLoading: boolean = false;

  constructor(
    private readonly calendarsService: CalendarsService,
    private readonly microsoftCalendarService: MicrosoftCalendarService
  ) {}

  public ngOnInit(): void {
    this.integrationFormGroup.get("sync").valueChanges.subscribe((value) => {
      console.log("vaa", value);
      this.syncLoading = true;
      if (value) {
        lastValueFrom(this.microsoftCalendarService.sync({ integrationId: this.integration._id, sync: true })).then((res) => {
          if (res.success) {
            this.onSubmitted.emit();
          }
          this.syncLoading = false;
        });
      } else {
        lastValueFrom(this.microsoftCalendarService.unsync({ integrationId: this.integration._id, sync: false })).then((res) => {
          if (res.success) {
            this.onSubmitted.emit();
          }
          this.syncLoading = false;
        });
      }
    });
  }

  public toggle(): void {
    this.showModal = !this.showModal;

    if (this.showModal) {
      const inSync = this.integration.calendars.find((c) => c.meta.insync);
      this.integrationFormGroup.get("sync").setValue(!isEmpty(inSync), { emitEvent: false });
    }
  }

  public onCheckCalendar(): void {
    const timer = setTimeout(() => {
      const calendars = this.integration.calendars
        .filter((c) => c.data.canEdit)
        .map((c) => {
          return { id: c._id, show: !c.selected };
        });
      console.log("call", calendars);
      this.onCheckedCalendars.emit(calendars);
      clearTimeout(timer);
    }, 100);
  }

  public onDelete() {
    this.unlinkLoading = true;
    lastValueFrom(this.calendarsService.unlink(this.integration._id)).then((res) => {
      if (res.success) {
        this.onDeleted.emit();
        this.showModal = false;
      }
      this.unlinkLoading = false;
    });
  }
}
