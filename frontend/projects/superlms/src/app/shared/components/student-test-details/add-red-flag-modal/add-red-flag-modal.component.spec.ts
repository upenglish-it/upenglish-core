import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddRedFlagModalComponent } from './add-red-flag-modal.component';

describe('AddRedFlagModalComponent', () => {
  let component: AddRedFlagModalComponent;
  let fixture: ComponentFixture<AddRedFlagModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddRedFlagModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddRedFlagModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
