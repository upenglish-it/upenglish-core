import { ComponentFixture, TestBed } from "@angular/core/testing";

import { TestClassManagerComponent } from "./test-class-manager.component";

describe("TestClassManagerComponent", () => {
  let component: TestClassManagerComponent;
  let fixture: ComponentFixture<TestClassManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestClassManagerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestClassManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
