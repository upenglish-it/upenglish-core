import { DatePipe, NgFor, NgIf, SlicePipe } from "@angular/common";
import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from "@angular/core";
import { FormArray, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { Animations } from "@isms-core/constants";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { CreateStudentFormGroup } from "@isms-core/form-group";
import { IAccount } from "@isms-core/interfaces";
import { StudentsService } from "@isms-core/services";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { lastValueFrom } from "rxjs";
import { AddStudentManuallyModalComponent } from "../add-student-manually-modal/add-student-manually-modal.component";
import { ImportStudentFromCSVDrawerComponent } from "../import-student-from-csv-drawer/import-student-from-csv-drawer.component";
import { NoteLogComponent } from "@isms-core/components/activity/note-log/note-log.component";
import { NzTagModule } from "ng-zorro-antd/tag";

@Component({
  selector: "isms-choose-students-modal",
  templateUrl: "./choose-students-modal.component.html",
  animations: [Animations.default],
  imports: [
    DatePipe,
    NgIf,
    NgFor,
    SlicePipe,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    AddStudentManuallyModalComponent,
    ImportStudentFromCSVDrawerComponent,
    NzCheckboxModule,
    NzInputModule,
    NzDropDownModule,
    NzModalModule,
    NzButtonModule,
    ProfilePhotoDirective,
    NoteLogComponent,
    NzTagModule,
  ],
})
export class ChooseStudentModalComponent implements OnInit {
  @ViewChild("addStudentManuallyModal") addStudentManuallyModal: AddStudentManuallyModalComponent;
  @Output("on-select") public readonly onSelectEmitter: EventEmitter<Array<string>> = new EventEmitter<Array<string>>();
  @Input("student-ids") public studentIds: Array<string> = [];
  public showModal: boolean = false;

  public students: Array<IAccount> = [];
  public createStudentFormGroup: FormGroup = CreateStudentFormGroup();
  public selectedStudentsFormArray: FormArray = new FormArray([]);

  public nzIndeterminateStudent = false;
  public showGrouping = true;
  public showSmartFilter = true;

  constructor(private readonly studentService: StudentsService) {}

  public ngOnInit(): void {
    this.loadData();
  }

  public loadData(): void {
    this.students = [];
    this.selectedStudentsFormArray.clear();

    lastValueFrom(this.studentService.fetch({ customQuery: JSON.stringify({ official: false, won: false }) })).then((res) => {
      if (res.success) {
        this.students = (res.data.items as Array<IAccount>)
          .filter((c: IAccount) => {
            const exist = this.studentIds.find((cid) => cid === c._id);
            return !exist;
          })
          .map((c: IAccount) => {
            c.selected = false;
            return c;
          });
      } else {
        this.students = [];
      }

      console.log("this.students", this.students);
    });
  }

  public toggle(): void {
    this.loadData();
    this.showModal = !this.showModal;
  }

  public groupingChange(event: any): void {
    console.log("event", event);
  }

  public onSelectAll(studentId: string): void {
    // this.students.map((c: IAccount) => {
    //   c.selected = false;
    //   return c;
    // });

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
