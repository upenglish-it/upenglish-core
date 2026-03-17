import { ComponentFixture, TestBed } from "@angular/core/testing";

import { StudentTestDetailsPage } from "./student-test-details.component";

describe("StudentTestDetailsPage", () => {
  let component: StudentTestDetailsPage;
  let fixture: ComponentFixture<StudentTestDetailsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentTestDetailsPage],
    }).compileComponents();

    fixture = TestBed.createComponent(StudentTestDetailsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
