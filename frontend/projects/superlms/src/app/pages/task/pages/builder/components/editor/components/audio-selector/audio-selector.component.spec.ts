import { ComponentFixture, TestBed } from "@angular/core/testing";

import { AudioSelectorComponent } from "./audio-selector.component";

describe("AudioSelectorComponent", () => {
  let component: AudioSelectorComponent;
  let fixture: ComponentFixture<AudioSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioSelectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
