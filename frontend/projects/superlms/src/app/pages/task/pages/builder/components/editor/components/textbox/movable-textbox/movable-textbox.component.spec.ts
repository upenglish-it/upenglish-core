import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MovableTextboxComponent } from './movable-textbox.component';

describe('MovableTextboxComponent', () => {
  let component: MovableTextboxComponent;
  let fixture: ComponentFixture<MovableTextboxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovableTextboxComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovableTextboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
