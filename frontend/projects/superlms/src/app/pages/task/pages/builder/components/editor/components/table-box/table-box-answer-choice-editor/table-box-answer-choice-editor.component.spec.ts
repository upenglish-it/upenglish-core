import { ComponentFixture, TestBed } from "@angular/core/testing";

import { TableBoxAnswerChoiceEditorComponent } from "./table-box-answer-choice-editor.component";

describe("TableBoxAnswerChoiceEditorComponent", () => {
  let component: TableBoxAnswerChoiceEditorComponent;
  let fixture: ComponentFixture<TableBoxAnswerChoiceEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableBoxAnswerChoiceEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TableBoxAnswerChoiceEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
