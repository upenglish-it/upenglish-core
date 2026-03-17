import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IAPIResponse } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";
import { ApiService } from "../../api.service";
import { QueryParams } from "@isms-core/types/src/query-params.type";

@Injectable({
  providedIn: "root",
})
export class StaffsService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/staffs`;
  }

  public fetch(query?: QueryParams): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}`, query);
  }

  public fetchById(id: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/${id}`);
  }

  public updatePersonalInformation(data: any, id: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/${id}/personal-information`, data);
  }

  public updateEmploymentSettings(data: any, id: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/${id}/employment-settings`, data);
  }

  public fetchEmploymentSettings(id: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/${id}/employment-settings`);
  }

  public fetchStaffSalaryById(staffId: string, date: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/${staffId}/salary`, { date });
  }

  public setSalaryByDate(id: string, body: any): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/${id}/salary/by-date`, body);
  }

  public removeSalaryByDate(id: string, body: any): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.#apiUrl}/${id}/salary/by-date`, body);
  }

  public fetchSalaryHistoryById(id: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/${id}/salary-history`);
  }

  public addTags(body: { studentIds: Array<string>; tags: Array<string> }): Observable<IAPIResponse> {
    return this.apiService.put(`${this.#apiUrl}/add-tags`, body);
  }

  public addSources(body: { studentIds: Array<string>; sources: Array<string> }): Observable<IAPIResponse> {
    return this.apiService.put(`${this.#apiUrl}/add-sources`, body);
  }

  public create(body: any): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}`, {
      ...body,
      createdFrom: "manual",
    });
  }

  public bulkCreate(body: any): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/bulk`, {
      ...body,
      createdFrom: "csv",
    });
  }

  public createSalaryPackage<T>(staffId: string, body: T): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/${staffId}/salary/create-package`, body);
  }

  public updateSalaryPackage<T>(staffId: string, salaryPackageId: string, body: T): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/${staffId}/salary/update-package/${salaryPackageId}`, body);
  }

  public fetchSalaryPackages(staffId: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/${staffId}/salary/packages`);
  }

  public fetchSalaryPackageById(staffId: string, salaryPackageId: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/${staffId}/salary/package`, { salaryPackageId });
  }

  public assignSalaryPackage<T>(staffId: string, body: T): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/${staffId}/salary/assign-package`, body);
  }

  public assignedSalaryPackage(staffId: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/${staffId}/salary/assigned-package`);
  }

  public updateEmployeeInformation<T>(staffId: string, body: T): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/${staffId}/employee-information/update`, body);
  }

  public setSalaryAdvancement<T>(staffId: string, body: T): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/${staffId}/salary/set-advancement`, body);
  }

  public fetchSalaryAdvancement(staffId: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/${staffId}/salary/fetch-advancement`);
  }

  public updateSalaryIncrease<T>(staffId: string, body: T): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/${staffId}/salary-increase`, body);
  }
}
