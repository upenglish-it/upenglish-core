/**
 * Classes Component
 *
 * @file          classes.component
 * @description   Dashboard page for student
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

//--- NG Modules
import { RouterLink } from "@angular/router";
import { Component, inject } from "@angular/core";
import { NzSpinModule } from "ng-zorro-antd/spin";
//--- Interfaces
import { ClassForCoursesI } from "@superlms/models/classes/classes.endpoints.datatypes";
//--- Services
import { ApiService } from "@superlms/services/api/api.service";
//--- Components
import { ClassListComponent } from "@superlms/shared/components/class-list/class-list.component";

@Component({
  selector: "slms-classes",
  imports: [
    //--- NG Modules
    RouterLink,
    NzSpinModule,
    //--- Components
    ClassListComponent,
  ],
  templateUrl: "./classes.component.html",
  styleUrl: "./classes.component.less",
})
export class ClassesComponent {
  //--- Injectables
  private apiService: ApiService = inject(ApiService);

  //--- Publics
  public assignedClasses: ClassForCoursesI[] = [];
  public isLoading = false;

  public get totalClasses(): number {
    return this.assignedClasses?.length || 0;
  }

  public get totalOngoingClasses(): number {
    return this.assignedClasses.filter((item) => item.status === "ongoing").length;
  }

  public get totalNotStartedClasses(): number {
    return this.assignedClasses.filter((item) => item.status === "not-started").length;
  }

  public get totalFinishedClasses(): number {
    return this.assignedClasses.filter((item) => item.status === "finished" || item.status === "completed").length;
  }

  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {
    this.isLoading = true;
    this.apiService.endPointsC.classes.get
      .adminClasses(this.apiService)
      .then((res) => {
        if (res) {
          this.assignedClasses = res.data;
        }
      })
      .finally(() => {
        this.isLoading = false;
      });
  }
}
