import { ComponentFixture, TestBed } from "@angular/core/testing";

import { TestDetailsManagerComponent } from "./test-course-manager.component";

describe("TestDetailsManagerComponent", () => {
  let component: TestDetailsManagerComponent;
  let fixture: ComponentFixture<TestDetailsManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestDetailsManagerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestDetailsManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
