import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TakingTaskComponent } from './taking-task.component';

describe('TakingTaskComponent', () => {
  let component: TakingTaskComponent;
  let fixture: ComponentFixture<TakingTaskComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TakingTaskComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TakingTaskComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
