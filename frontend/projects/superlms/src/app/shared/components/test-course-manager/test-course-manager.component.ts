/**
 * Test Course Manager Component
 *
 * @file          test-course-manager.component
 * @description   Test Course Manager for student
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { Component, inject, Input, OnInit, ViewChild } from "@angular/core";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { TestOfClass } from "@superlms/models/tests/test-of-class/test-of-class.endpoints.datatypes";
import { GetTestOfClassResponseI } from "@superlms/models/tests/test-of-class/test-of-class.endpoints.get.model";
import { AccountService } from "@superlms/services/account/account.service";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
import { ChooseTestModalComponent } from "@superlms/shared/components/choose-test-modal/choose-test-modal.component";
//--- NG Zorro
import { NzBadgeModule } from "ng-zorro-antd/badge";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzListModule } from "ng-zorro-antd/list";
import { NzMessageService } from "ng-zorro-antd/message";
import { NzModalService } from "ng-zorro-antd/modal";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { debounceTime, distinctUntilChanged } from "rxjs";

@Component({
  selector: "slms-test-course-manager",
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    //--- NG Zorro
    NzBadgeModule,

    //--- NG Zorro
    NzTagModule,
    NzListModule,
    NzBadgeModule,
    NzInputModule,
    NzEmptyModule,
    NzButtonModule,
    NzToolTipModule,
    NzDropDownModule,
    NzCollapseModule,

    //--- Components
    ChooseTestModalComponent,
  ],
  templateUrl: "./test-course-manager.component.html",
  styleUrl: "./test-course-manager.component.less",
})
export class TestCourseManagerComponent implements OnInit {
  @ViewChild("chooseTestModal") chooseTestModal: ChooseTestModalComponent;

  //--- Input
  @Input({ alias: "back-route", required: true }) public backRoute: string;
  @Input({ alias: "back-title", required: true }) public backTitle: string;
  @Input({ alias: "class-id", required: true }) public classId: string;

  //--- Injectables
  // public router: Router = inject(Router);
  private apiService: ApiService = inject(ApiService);
  // public activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  public nzModalService: NzModalService = inject(NzModalService);
  public accountService: AccountService = inject(AccountService);
  public nzMessageService: NzMessageService = inject(NzMessageService);

  //--- Public
  public testOfClass: GetTestOfClassResponseI | null = null;
  public descriptionFormControl = new FormControl<string>("");

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.loadTestOfClass();

    this.descriptionFormControl.valueChanges.pipe(debounceTime(500), distinctUntilChanged()).subscribe((value) => {
      this.descriptionChange(value || "");

      // [ngModel] = "testOfClass.test.description"(ngModelChange) = "descriptionChange($event)";
    });
  }

  public loadTestOfClass(): void {
    this.apiService.endPointsC.testOfClass.get.getTestOfClass(this.apiService, { classId: this.classId }).then((res) => {
      if (res.success) {
        this.testOfClass = res.data;
        this.descriptionFormControl.setValue(this.testOfClass.test.description || "", { emitEvent: false });
      }
    });
  }

  public editTask(selectedTask: any): void {
    // Handle task editing
    // this.router.navigateByUrl("/task/1/builder");
  }

  public descriptionChange(description: string): void {
    this.apiService.endPointsC.testOfClass.patch.updateDescription(this.apiService, { classId: this.classId, description: description }).then((res) => {
      if (res.success) {
        // this.loadTestOfClass();
      }
    });
  }

  public updateStatus(status: "draft" | "published"): void {
    this.apiService.endPointsC.testOfClass.patch.updateStatus(this.apiService, { classId: this.classId, status: status }).then((res) => {
      if (res.success) {
        this.loadTestOfClass();
        this.nzMessageService.success(`Course status updated to ${status}.`);
      }
    });
  }

  public addPeriod(): void {
    this.apiService.endPointsC.testOfClass.post.addPeriod(this.apiService, { name: "Untitled Period", classId: this.classId }).then((res) => {
      if (res.success) {
        this.loadTestOfClass();
      }
    });
  }

  public periodNameChange(periodId: string, newName: string): void {
    this.apiService.endPointsC.testOfClass.patch.updatePeriodName(this.apiService, periodId, newName).then((res) => {
      if (res.success) {
        // this.loadTestOfCourse();
      }
    });
  }

  public addSection(periodId: string, type: "assignment" | "mini-test"): void {
    this.apiService.endPointsC.testOfClass.post
      .addSection(this.apiService, {
        name: "Untitled Section",
        testOfClassId: this.testOfClass.test._id,
        classId: this.classId,
        periodId: periodId,
        type: type,
      })
      .then((res) => {
        if (res.success) {
          this.loadTestOfClass();
        }
      });
  }

  public deletePeriod(periodId: string): void {
    this.nzModalService.confirm({
      nzTitle: "Do you want to delete this section?",
      nzContent: "This action cannot be undone.",
      nzOkText: "Remove",
      nzOkDanger: true,
      nzOnOk: () => {
        this.apiService.endPointsC.testOfClass.delete.deletePeriodById(this.apiService, periodId).then((res) => {
          if (res.success) {
            this.loadTestOfClass();
          }
        });
      },
    });
  }

  public sectionNameChange(sectionId: string, newName: string): void {
    this.apiService.endPointsC.testOfClass.patch.updateSectionName(this.apiService, sectionId, newName).then((res) => {
      if (res.success) {
        // this.loadTestOfCourse();
      }
    });
  }

  public addTest(periodId: string, sectionId: string): void {
    this.chooseTestModal.testFormGroup.get("testsOfClassId")?.setValue(this.testOfClass.test._id);
    this.chooseTestModal.testFormGroup.get("classId")?.setValue(this.classId);
    this.chooseTestModal.testFormGroup.get("periodId")?.setValue(periodId);
    this.chooseTestModal.testFormGroup.get("sectionId")?.setValue(sectionId);
    this.chooseTestModal.toggle();
  }

  /**
   * @name          updateSectionVisibility
   * @description   Updates the visibility of a section to show it to students
   * @returns       {void}
   */
  public updateSectionVisibility(): void {}

  public deleteSection(periodId: string, sectionId: string): void {
    this.nzModalService.confirm({
      nzTitle: "Do you want to delete this section?",
      nzContent: "This action cannot be undone.",
      nzOkText: "Remove",
      nzOkDanger: true,
      nzOnOk: () => {
        this.apiService.endPointsC.testOfClass.delete.deleteSectionById(this.apiService, { periodId: periodId, sectionId: sectionId }).then((res) => {
          if (res.success) {
            this.loadTestOfClass();
          }
        });
      },
    });
  }

  public deleteTest(periodId: string, sectionId: string, testId: string): void {
    this.nzModalService.confirm({
      nzTitle: "Do you want to remove these test?",
      nzContent: "This action cannot be undone.",
      nzOkText: "Remove",
      nzOkDanger: true,
      nzOnOk: () => {
        this.apiService.endPointsC.testOfClass.delete.deleteTestById(this.apiService, { periodId: periodId, sectionId: sectionId, testId: testId }).then((res) => {
          if (res.success) {
            this.loadTestOfClass();
          }
        });
      },
    });
  }
}
