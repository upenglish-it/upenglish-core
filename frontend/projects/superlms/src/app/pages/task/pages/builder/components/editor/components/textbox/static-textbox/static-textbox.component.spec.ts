import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StaticTextboxComponent } from './static-textbox.component';

describe('StaticTextboxComponent', () => {
  let component: StaticTextboxComponent;
  let fixture: ComponentFixture<StaticTextboxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaticTextboxComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StaticTextboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
