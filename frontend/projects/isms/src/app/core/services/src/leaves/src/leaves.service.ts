import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IAPIResponse } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";
import { ApiService } from "../../api.service";

@Injectable({ providedIn: "root" })
export class LeavesService {
  #apiUrl: string;

  constructor(private readonly apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/leaves`;
  }

  // public fetch(query?: { limit?: number; skip?: number; status?: string; branches?: Array<string> }): Observable<IAPIResponse> {
  //   return this.apiService.get(`${this.#apiUrl}`);
  // }

  // public fetchById(id: string): Observable<IAPIResponse> {
  //   return this.apiService.get(`${this.#apiUrl}/${id}`);
  // }

  // public updateById(body: any, id: string): Observable<IAPIResponse> {
  //   return this.apiService.patch(`${this.#apiUrl}/${id}`, body);
  // }

  // public delete(id: string): Observable<IAPIResponse> {
  //   return this.apiService.delete(`${this.#apiUrl}/${id}`);
  // }

  public fetchStaff(body: any): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/staff`, body);
  }

  public addStaffRequest(body: any): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/staff/request`, body);
  }

  public fetchStaffRequest(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/staff/request`);
  }

  public actionRequest<T>(body: T): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/action`, body);
  }
}
