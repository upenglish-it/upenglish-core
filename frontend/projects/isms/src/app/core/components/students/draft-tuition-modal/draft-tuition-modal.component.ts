import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, TemplateRef } from "@angular/core";
import { ClassesService, StudentsService } from "@isms-core/services";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzModalModule } from "ng-zorro-antd/modal";
import { IAccount, IClassStudent, IClassStudentRecord } from "@isms-core/interfaces";
import { debounceTime, lastValueFrom } from "rxjs";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzSelectModule } from "ng-zorro-antd/select";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { DateTime } from "luxon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { differenceInCalendarDays } from "date-fns";
import { SubSink } from "subsink";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { IPricing } from "../enroll-new-student-modal/enroll-new-student-modal.component";

@Component({
  selector: "isms-draft-tuition-modal",
  templateUrl: "./draft-tuition-modal.component.html",
  imports: [ReactiveFormsModule, NzModalModule, NzButtonModule, NzCheckboxModule, NzSelectModule, NzRadioModule, NzInputModule, NzDatePickerModule, NzAlertModule],
})
export class DraftTuitionModalComponent implements OnInit, OnDestroy {
  @Output("on-submitted") private readonly onSubmittedEmitter: EventEmitter<FormGroup> = new EventEmitter<FormGroup>();
  // @Input({ alias: "pricing", required: true }) public pricing!: IPricing;
  @Input({ alias: "form-data", required: true }) public formData!: FormGroup;
  @Input({ alias: "date-interval", required: true }) public dateInterval!: any;

  public formGroup = new FormGroup({
    draftId: new FormControl("", [Validators.required]),
    name: new FormControl("", [Validators.required]),
    studentClassId: new FormControl("", [Validators.required]),
  });
  private readonly subSink: SubSink = new SubSink();
  public showModal: boolean = false;
  public students: Array<IAccount> = [];
  public classes: Array<any> = [];
  public record: IClassStudentRecord = null;
  public viewState: "initial" | "updating" = "initial";

  public drafts: Array<any> = [];

  constructor(
    private readonly nzNotificationService: NzNotificationService,
    private readonly studentsService: StudentsService,
    private readonly classesService: ClassesService
  ) {}

  public ngOnInit(): void {
    this.subSink.add(
      this.formGroup
        .get("studentClassId")
        .valueChanges.pipe(debounceTime(100))
        .subscribe((value) => {
          this.loadData();
        })
    );

    // this.subSink.add(
    //   this.formGroup
    //     .get("draftId")
    //     .valueChanges.pipe(debounceTime(100))
    //     .subscribe((value) => {
    //       const associatedDraft = this.drafts.find((draft) => draft._id === value);
    //       if (associatedDraft) {
    //         this.onSubmittedEmitter.emit(associatedDraft);
    //       }
    //     })
    // );

    // this.subSink.add(
    //   this.formGroup
    //     .get("status")
    //     .valueChanges.pipe(debounceTime(100))
    //     .subscribe((value) => {
    //       if (value === "off-day") {
    //         this.formGroup.get("offDayRestriction").addValidators([Validators.requiredTrue]);
    //       } else {
    //         this.formGroup.get("offDayRestriction").clearValidators();
    //       }
    //       this.formGroup.get("offDayRestriction").updateValueAndValidity();
    //     })
    // );
    // lastValueFrom(this.studentsService.fetch()).then((res) => {
    //   this.students = res.success ? res.data : [];
    // });
  }

  public ngOnDestroy(): void {}

  public async loadData(): Promise<void> {
    lastValueFrom(this.classesService.fetchDraftTuition({ classes: this.formGroup.value.studentClassId })).then((res) => {
      this.drafts = res.success ? res.data : [];
    });
    // lastValueFrom(
    //   this.classesService.attendanceStudents({
    //     classId: this.formGroup.value.studentClassId,
    //     date: DateTime.fromJSDate(this.formGroup.value.date).toFormat("MM-yyyy"),
    //   })
    // ).then((res) => {
    //   const studentsInClass: Array<IClassStudent> = res.success ? res.data : [];
    //   this.students = studentsInClass.map((student) => student.account);
    //   if (res.success) {
    //     this.toggle();
    //   }
    // });
  }

  public toggle(): void {
    // this.resetFormGroup();
    this.showModal = !this.showModal;
  }

  public delete(): void {
    lastValueFrom(this.classesService.deleteDraftTuition(this.formGroup.value.draftId))
      .then((res) => {
        this.formGroup.get("draftId").reset();
        this.nzNotificationService.create(res.success ? "success" : "error", "Delete Draft tuition", res.message);
      })
      .finally(() => {
        this.formGroup.get("draftId").reset();
        this.loadData();
      });
  }

  public loadTemplate(): void {
    const associatedDraft = this.drafts.find((draft) => draft._id === this.formGroup.value.draftId);
    if (associatedDraft) {
      this.onSubmittedEmitter.emit(associatedDraft.data);
    }
  }

  public onSubmit(): void {
    this.viewState = "updating";
    console.log("studentIdsWithClass >> ", this.formGroup.value);
    lastValueFrom(
      this.classesService.saveDraftTuition({
        name: this.formGroup.value.name,
        classes: this.formGroup.value.studentClassId,
        data: { ...this.formData.value, dateInterval: this.dateInterval },
      })
    )
      .then((res) => {
        this.nzNotificationService.create(res.success ? "success" : "error", "Save Draft tuition", res.message);
        if (res.success) {
          this.toggle();
        }
      })
      .finally(() => {
        this.viewState = "initial";
        this.loadData();
      });
  }

  // public disabledPreviousDate = (current: Date): boolean => differenceInCalendarDays(current, DateTime.now().toJSDate()) < 0;
}
