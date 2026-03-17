import { ComponentFixture, TestBed } from "@angular/core/testing";

import { TableBoxInputBoxComponent } from "./table-box-input-box.component";

describe("TableBoxInputBoxComponent", () => {
  let component: TableBoxInputBoxComponent;
  let fixture: ComponentFixture<TableBoxInputBoxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableBoxInputBoxComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TableBoxInputBoxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // it("should create", () => {
  //   expect(component).toBeTruthy();
  // });
});
