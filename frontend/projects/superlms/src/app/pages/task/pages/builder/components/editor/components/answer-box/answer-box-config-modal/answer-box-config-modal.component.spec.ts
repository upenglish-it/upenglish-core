import { ComponentFixture, TestBed } from "@angular/core/testing";

import { AnswerBoxConfigModalComponent } from "./answer-box-config-modal.component";

describe("AnswerBoxConfigModalComponent", () => {
  let component: AnswerBoxConfigModalComponent;
  let fixture: ComponentFixture<AnswerBoxConfigModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnswerBoxConfigModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AnswerBoxConfigModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
