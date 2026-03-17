import { DatePipe } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { SectionContainerComponent } from "@isms-core/components/common/section-container/section-container.component";

@Component({
  selector: "isms-note-log",
  templateUrl: "./note-log.component.html",
  imports: [DatePipe, ReactiveFormsModule, SectionContainerComponent],
})
export class NoteLogComponent {
  @Input({ alias: "form-group", required: true }) public formGroup: FormGroup;
}
