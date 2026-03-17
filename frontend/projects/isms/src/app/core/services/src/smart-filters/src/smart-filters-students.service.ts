import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IAPIResponse } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";
import { ApiService } from "../../api.service";

@Injectable({
  providedIn: "root",
})
export class SmartFilterStudentsService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/smart-filter/students`;
  }

  public fetch(query?: { limit?: number; skip?: number; status?: string; branches?: Array<string> }): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}`, query);
  }

  public fetchFilterResult(ids: Array<string>): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/filter/result`, { ids: ids });
  }

  public fetchById(id: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/${id}`);
  }

  public update(data: any, id: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/${id}`, data);
  }

  public delete(data: any, id: string): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.#apiUrl}/${id}`, data);
  }

  public create(body: any): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}`, body);
  }
}
