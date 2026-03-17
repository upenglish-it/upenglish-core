import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "../../../api.service";
import { IAPIResponse } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";

@Injectable({
  providedIn: "root",
})
export class NotificationsService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/notifications`;
  }

  public fetch(): Observable<IAPIResponse> {
    return this.apiService.get(this.#apiUrl);
  }

  public markAll(payload: any): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}`, payload);
  }

  public update(payload: any): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}`, payload);
  }

  public updateGCM(token: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/gcm`, {
      token,
    });
  }
}
