// Angular imports
import { Observable } from "rxjs";
import { Injectable } from "@angular/core";
// Services
import { ApiService } from "../api.service";
// Types
import { SSOProviderT } from "@isms-core/types";
// Envs
import { environment } from "@isms-env/environment";
// Interfaces
import { IAPIResponse } from "@isms-core/interfaces";

export type ProviderT = "microsoft" | "google";
@Injectable({
  providedIn: "root",
})
export class SSOService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = environment.apiUrl;
  }

  public signIn(body: { provider: SSOProviderT }): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/auth/signin`, body);
  }

  public socialAuthorization(query: { code: string; state: string; session_state: string }): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/auth/social-authorization`, query);
  }

  public account(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/accounts`);
  }

  public updateById(body: any): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/accounts`, body);
  }
}
