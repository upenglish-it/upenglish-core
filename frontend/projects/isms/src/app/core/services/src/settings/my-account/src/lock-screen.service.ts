import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "../../../api.service";
import { IAPIResponse } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";

@Injectable({
  providedIn: "root",
})
export class LockScreenService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = environment.apiUrl;
  }

  public update(body: { enable: boolean; code: string; idleDuration: number }): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/lock-screen`, body);
  }
}
