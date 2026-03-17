import { ComponentFixture, TestBed } from "@angular/core/testing";

import { IELTSWritingComponent } from "./ielts-writing.component";

describe("IELTSWritingComponent", () => {
  let component: IELTSWritingComponent;
  let fixture: ComponentFixture<IELTSWritingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IELTSWritingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IELTSWritingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
