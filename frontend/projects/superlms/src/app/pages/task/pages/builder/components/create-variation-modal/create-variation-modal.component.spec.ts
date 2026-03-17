import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ChooseTestModalComponent } from "./choose-test-modal.component";

describe("ChooseTestModalComponent", () => {
  let component: ChooseTestModalComponent;
  let fixture: ComponentFixture<ChooseTestModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChooseTestModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChooseTestModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
