import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimelineTestResultComponent } from './timeline-test-result.component';

describe('TimelineTestResultComponent', () => {
  let component: TimelineTestResultComponent;
  let fixture: ComponentFixture<TimelineTestResultComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineTestResultComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TimelineTestResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
