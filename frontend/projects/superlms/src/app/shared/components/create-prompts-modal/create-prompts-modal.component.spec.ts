import { ComponentFixture, TestBed } from "@angular/core/testing";

import { CreatePromptsModalComponent } from "./create-prompts-modal.component";

describe("CreatePromptsModalComponent", () => {
  let component: CreatePromptsModalComponent;
  let fixture: ComponentFixture<CreatePromptsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreatePromptsModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CreatePromptsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
