import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IAPIResponse } from "@isms-core/interfaces";
import { ApiService } from "../../api.service";
import { environment } from "@isms-env/environment";

@Injectable({ providedIn: "root" })
export class DashboardAdminService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/dashboard/admin`;
  }

  public fetchStatistics(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/statistics`);
  }

  public fetchBirthdaysByMonth(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/birthdays-by-month`);
  }

  public fetchEmployeeAnniversary(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/employee-anniversary`);
  }

  public fetchSalaryIncrease(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/salary-increase`);
  }
}
