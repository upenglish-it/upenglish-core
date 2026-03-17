import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ICourse } from "@isms-core/interfaces";
import { NzModalModule } from "ng-zorro-antd/modal";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzButtonModule } from "ng-zorro-antd/button";
import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NumberOnlyDirective } from "@isms-core/directives";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { lastValueFrom } from "rxjs";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzTimePickerModule } from "ng-zorro-antd/time-picker";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { TaskFormGroup } from "@isms-core/form-group";
import { TasksService } from "@isms-core/services";
import { ActivatedRoute, Router } from "@angular/router";
import { TaskResultComponent } from "../task-result/task-result.component";

@Component({
  selector: "isms-review-task-submission-modal",
  templateUrl: "./review-task-submission-modal.component.html",
  imports: [
    NgIf,
    NgFor,
    JsonPipe,
    ReactiveFormsModule,
    SegmentedSelectorComponent,
    NumberOnlyDirective,
    NzDrawerModule,
    NzModalModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzIconModule,
    NzRadioModule,
    NzToolTipModule,
    NzDatePickerModule,

    NzTimePickerModule,
    TaskResultComponent,
  ],
})
export class ReviewTaskSubmissionModalComponent implements OnInit {
  @Output("on-submitted") onSubmitted: EventEmitter<ICourse> = new EventEmitter();
  @Input("view-type") public viewType: "page" | "viewing-modal" | "reviewing-modal" = "page";

  public submissionId: string;

  public loading: boolean = false;
  public showModal: boolean = false;

  public readonly modalWidth = `${window.innerWidth <= 480 ? window.innerWidth : window.innerWidth - 300}px`;

  constructor() {}

  public ngOnInit(): void {}

  public toggle(): void {
    this.showModal = !this.showModal;
    this.submissionId = null;
  }
}
