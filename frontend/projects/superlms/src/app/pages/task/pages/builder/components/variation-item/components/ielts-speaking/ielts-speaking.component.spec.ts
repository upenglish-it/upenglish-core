import { ComponentFixture, TestBed } from "@angular/core/testing";

import { IELTSSpeakingComponent } from "./ielts-speaking.component";

describe("IELTSSpeakingComponent", () => {
  let component: IELTSSpeakingComponent;
  let fixture: ComponentFixture<IELTSSpeakingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IELTSSpeakingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IELTSSpeakingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
