import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IAPIResponse } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";
import { ApiService } from "../../api.service";

@Injectable({ providedIn: "root" })
export class CourseGroupsService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/courses-groups`;
  }

  public fetch(query?: { limit?: number; skip?: number; status?: string; branches?: Array<string> }): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}`, query);
  }

  public fetchById(id: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/${id}`);
  }

  public create(body: any): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}`, body);
  }

  public updateById(body: any, id: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/${id}`, body);
  }

  public delete(id: string): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.#apiUrl}/${id}`);
  }
}
