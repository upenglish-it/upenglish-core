import { DatePipe, DecimalPipe, NgFor } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IMaterial } from "@isms-core/interfaces";
import { SubSink } from "subsink";
import { MaterialsService, NGRXService } from "@isms-core/services";
import { debounceTime, distinctUntilChanged, lastValueFrom } from "rxjs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { ManageMaterialModalComponent } from "../manage-material-modal/manage-material-modal.component";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";

@Component({
  selector: "isms-material-listing",
  templateUrl: "./material-listing.component.html",
  imports: [
    NgFor,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    DecimalPipe,
    NzTagModule,
    NzInputModule,
    NzDropDownModule,
    NzButtonModule,
    NzCheckboxModule,
    NzPopconfirmModule,
    ManageMaterialModalComponent,
  ],
})
export class MaterialListingComponent {
  @ViewChild("manageMaterialModal") manageMaterialModal: ManageMaterialModalComponent;
  private subSink: SubSink = new SubSink();
  public selectedBranch: string = null;
  private materials: Array<IMaterial> = [];
  public filteredMaterials: Array<IMaterial> = [];
  public filterFormGroup: FormGroup = new FormGroup({
    searchQuery: new FormControl(null),
    limit: new FormControl(50),
    skip: new FormControl(0),
    status: new FormControl("active"),
    branches: new FormControl([]),
  });

  constructor(
    private readonly materialsService: MaterialsService,
    private readonly ngrxService: NGRXService,
    private readonly nzNotificationService: NzNotificationService
  ) {
    this.subSink.add(this.ngrxService.selectedBranch().subscribe((res) => (this.selectedBranch = res)));
  }

  public ngOnInit(): void {
    this.loadData();
    this.subSink.add(
      this.filterFormGroup
        .get("searchQuery")
        .valueChanges.pipe(distinctUntilChanged(), debounceTime(100))
        .subscribe((value) => {
          this.filteredMaterials = this.find(this.materials, value);
        })
    );
  }

  /* Temporary search filter. Refactor this later */
  private find(arr: any[], pat: string) {
    let pa = pat
      .trim()
      .replace(/ +/g, " ")
      .split(" ")
      .map((p: string | RegExp) => new RegExp(p, "i"));
    return arr.filter((n: { name: string }) => {
      let name = n.name;
      return pa.every((p: { test: (arg0: string) => any }) => p.test(name));
    });
  }

  public async loadData(): Promise<void> {
    lastValueFrom(this.materialsService.fetch({ limit: 100 })).then((res) => {
      if (res.success) {
        this.setStudents(res.data);
      } else {
        this.resetStudents();
      }
    });
  }

  public onEdit(id: string): void {
    this.manageMaterialModal.materialId = id;
    this.manageMaterialModal.toggle();
  }

  public onDelete(id: string): void {
    lastValueFrom(this.materialsService.delete(id)).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Delete Item", res.message, { nzPlacement: "bottomRight" });
      this.loadData();
    });
  }

  public identify = (index: number, item: IMaterial) => {
    return item._id;
  };

  public onSubmitted(value: IMaterial): void {
    this.materials.unshift(value);
    this.filteredMaterials.unshift(value);
  }

  private setStudents(values: Array<IMaterial>): void {
    this.materials = values;
    this.filteredMaterials = values;
  }

  private resetStudents(): void {
    this.materials = [];
    this.filteredMaterials = [];
  }
}
