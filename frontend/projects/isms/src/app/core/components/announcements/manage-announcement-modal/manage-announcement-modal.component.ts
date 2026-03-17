import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ICourse } from "@isms-core/interfaces";
import { NzModalModule } from "ng-zorro-antd/modal";
import { SegmentedSelectorComponent } from "@isms-core/components/common/segmented-selector/segmented-selector.component";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzButtonModule } from "ng-zorro-antd/button";
import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NumberOnlyDirective } from "@isms-core/directives";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { lastValueFrom } from "rxjs";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { SubSink } from "subsink";
import { AnnouncementFormGroup, ClassDayFormGroup } from "@isms-core/form-group";
import { AnnouncementsService, ClassesDaysService, ClassesService } from "@isms-core/services";
import { NzTimePickerModule } from "ng-zorro-antd/time-picker";
import { Days } from "@isms-core/constants";

@Component({
  selector: "isms-manage-announcement-modal",
  templateUrl: "./manage-announcement-modal.component.html",
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    NzDrawerModule,
    NzModalModule,
    NzButtonModule,
    NzInputModule,
    NzTagModule,
    NzSelectModule,
    NzIconModule,
    NzToolTipModule,
    NzDatePickerModule,
    NzTimePickerModule,
  ],
})
export class ManageAnnouncementModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") onSubmitted: EventEmitter<ICourse> = new EventEmitter();
  public announcementFormGroup: FormGroup = AnnouncementFormGroup();
  private subSink: SubSink = new SubSink();
  public loading: boolean = false;
  public showModal: boolean = false;
  public announcementId: string = null;
  public classes: Array<any> = [];

  constructor(
    private readonly announcementsService: AnnouncementsService,
    private readonly classesService: ClassesService,
    private readonly nzNotificationService: NzNotificationService
  ) {}

  public ngOnInit(): void {
    lastValueFrom(this.classesService.fetch()).then((res) => {
      this.classes = res.success ? res.data : [];
    });
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  private loadData(): void {
    this.loading = true;
    lastValueFrom(this.announcementsService.fetchById(this.announcementId)).then((res) => {
      this.loading = false;
      if (res.success) {
        this.announcementFormGroup.get("_id").setValue(res.data._id);
        this.announcementFormGroup.get("classId").setValue(res.data.classes);
        this.announcementFormGroup.get("title").setValue(res.data.title);
        this.announcementFormGroup.get("message").setValue(res.data.message);
      }
    });
  }

  public toggle(): void {
    this.showModal = !this.showModal;
    this.announcementFormGroup.reset();
    if (this.showModal && this.announcementId) {
      this.loadData();
    }
  }

  public onCreate(): void {
    this.announcementFormGroup.markAllAsTouched();
    if (this.announcementFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.announcementsService.create({
          classId: this.announcementFormGroup.value.classId,
          title: this.announcementFormGroup.value.title,
          message: this.announcementFormGroup.value.message,
        })
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Create Announcement", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }

  public onUpdate(): void {
    this.announcementFormGroup.markAllAsTouched();
    if (this.announcementFormGroup.valid) {
      this.loading = true;
      lastValueFrom(
        this.announcementsService.updateById(
          {
            classId: this.announcementFormGroup.value.classId,
            title: this.announcementFormGroup.value.title,
            message: this.announcementFormGroup.value.message,
          },
          this.announcementFormGroup.value._id
        )
      ).then((res) => {
        this.loading = false;
        if (res.success) {
          this.toggle();
          this.showModal = false;
          this.onSubmitted.emit(res.data);
        }
        this.nzNotificationService.create(res.success ? "success" : "error", "Update Announcement", res.message, { nzPlacement: "bottomRight" });
      });
    }
  }
}
