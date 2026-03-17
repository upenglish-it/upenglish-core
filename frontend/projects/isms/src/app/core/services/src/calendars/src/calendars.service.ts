import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IAPIResponse } from "@isms-core/interfaces";
import { ApiService } from "../../api.service";
import { environment } from "@isms-env/environment";

@Injectable({ providedIn: "root" })
export class CalendarsService {
  #apiUrl: string;

  constructor(private readonly apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/calendars`;
  }

  public integrated(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/integrated`);
  }

  public unlink(integrationId: string): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.#apiUrl}/unlink/${integrationId}`);
  }

  public fetchIntegratedById(integrationId: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/integrated/${integrationId}`);
  }

  public create<T>(body: T): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/events`, body);
  }

  public delete(eventId: string): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.#apiUrl}/events/${eventId}`);
  }

  public fetchEvents(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/events`);
  }

  public updateEvent<T>(eventId: string, body: T): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/events/${eventId}`, body);
  }
}
