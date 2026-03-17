import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IAPIResponse } from "@isms-core/interfaces";
import { ApiService } from "../../api.service";
import { environment } from "@isms-env/environment";

@Injectable({ providedIn: "root" })
export class AnnouncementsService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/announcements`;
  }

  public fetch(query?: { limit?: number; skip?: number; status?: string; branches?: Array<string> }): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}`);
  }

  public fetchById(id: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/${id}`);
  }

  public fetchParticipantById(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/participant/by-id`);
  }

  public create(body: any): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}`, body);
  }

  public updateById(body: any, id: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/${id}`, body);
  }

  public verify(id: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/${id}/verify`);
  }

  public delete(id: string): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.#apiUrl}/${id}`);
  }
}
