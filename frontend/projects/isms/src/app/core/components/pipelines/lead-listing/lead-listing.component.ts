import { DatePipe, NgFor, SlicePipe } from "@angular/common";
import { Component, inject, OnInit, ViewChild } from "@angular/core";
import { FormArray, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { CreateStudentFormGroup } from "@isms-core/form-group";
import { IAccount } from "@isms-core/interfaces";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzTagModule } from "ng-zorro-antd/tag";
import { AddStudentManuallyModalComponent } from "@isms-core/components/students/add-student-manually-modal/add-student-manually-modal.component";
import { StudentsService } from "@isms-core/services";
import { lastValueFrom } from "rxjs";

@Component({
  selector: "isms-lead-listing",
  imports: [
    DatePipe,
    NgFor,
    SlicePipe,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    NzCheckboxModule,
    NzInputModule,
    NzDropDownModule,
    NzModalModule,
    NzButtonModule,
    ProfilePhotoDirective,
    NzTagModule,
    AddStudentManuallyModalComponent,
  ],
  templateUrl: "./lead-listing.component.html",
})
export class LeadLinstingComponent implements OnInit {
  @ViewChild("addStudentManuallyModal") addStudentManuallyModal: AddStudentManuallyModalComponent;

  public students: Array<IAccount> = [];
  public createStudentFormGroup: FormGroup = CreateStudentFormGroup();
  public selectedStudentsFormArray: FormArray = new FormArray([]);

  public readonly studentService: StudentsService = inject(StudentsService);

  public nzIndeterminateStudent = false;

  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
  });

  ngOnInit(): void {
    lastValueFrom(
      this.studentService.fetch({
        customQuery: JSON.stringify({
          official: false,
          won: false,
        }),
      })
    ).then((res) => (this.students = res.data.items));
  }

  public onSelectAll(studentId: string): void {
    if (studentId === "all") {
      if (this.selectedStudentsFormArray.length === this.students.length) {
        this.students = this.students.map((c: IAccount) => {
          c.selected = false;
          return c;
        });
        this.selectedStudentsFormArray.clear();
      } else {
        this.selectedStudentsFormArray.clear();
        this.students = this.students.map((c: IAccount) => {
          c.selected = true;
          this.selectedStudentsFormArray.push(new FormControl(c._id));
          return c;
        });
      }
      this.nzIndeterminateStudent = false;
    } else {
      console.log("this.selectedStudentsFormArray.value", this.selectedStudentsFormArray.value);
      const existIndex = this.selectedStudentsFormArray.value.findIndex((cId: string) => cId === studentId);

      console.log(existIndex);
      if (existIndex === -1) {
        this.students.map((c: IAccount) => {
          if (c._id === studentId) {
            c.selected = c._id === studentId;
          }
          return c;
        });
        this.selectedStudentsFormArray.push(new FormControl(studentId));
      } else {
        this.selectedStudentsFormArray.removeAt(existIndex);
      }

      console.log(this.selectedStudentsFormArray.length, this.students.length);
      this.nzIndeterminateStudent = false;

      // this.nzIndeterminateStudent =
      //   this.selectedStudentsFormArray.length !== this.students.length ||
      //   this.selectedStudentsFormArray.length === 0;
    }
  }

  public onSubmittedAddStudentManually(student: IAccount): void {
    student.selected = false;
    this.students.unshift(student);
  }

  public createStudentManually(): void {
    this.addStudentManuallyModal.toggle();
    this.addStudentManuallyModal.createStudentFormGroup.get("official").setValue(false);
  }
}
