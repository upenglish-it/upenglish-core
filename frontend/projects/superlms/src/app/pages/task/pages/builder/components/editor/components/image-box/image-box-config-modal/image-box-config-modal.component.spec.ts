import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ImageBoxConfigModalComponent } from "./image-box-config-modal.component";

describe("ImageBoxConfigModalComponent", () => {
  let component: ImageBoxConfigModalComponent;
  let fixture: ComponentFixture<ImageBoxConfigModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageBoxConfigModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ImageBoxConfigModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
