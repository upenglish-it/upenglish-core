import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "../../../api.service";
import { IAPIResponse } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";

@Injectable({
  providedIn: "root",
})
export class BranchesService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = environment.apiUrl;
  }

  public fetch(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/branches`);
  }

  public assignedBranches(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/branches/assigned`);
  }

  public create(payload: { name: string; address: string }): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/branches`, payload);
  }

  public update(payload: { name: string; address: string }, id: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/branches/${id}`, payload);
  }

  public switch(payload: { branchId: string }): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/branches/switch`, payload);
  }

  public delete(id: string): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.#apiUrl}/branches/${id}`);
  }

  public undo(id: string): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/branches/${id}/undo`);
  }
}
