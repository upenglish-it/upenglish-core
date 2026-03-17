import { Component, Input } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { SectionContainerComponent } from "@isms-core/components/common/section-container/section-container.component";
import { TimeAgoPipe } from "@isms-core/pipes";

@Component({
  selector: "isms-conversation-item",
  templateUrl: "./conversation-item.component.html",
  imports: [ReactiveFormsModule, SectionContainerComponent, TimeAgoPipe],
})
export class ConversationItemComponent {
  @Input({ alias: "form-group", required: true }) public formGroup: FormGroup;
}
