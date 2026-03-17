import { Injectable } from "@angular/core";
import { Observable, throwError } from "rxjs";
import { ApiService } from "../api.service";
import { HttpErrorResponse } from "@angular/common/http";
import { catchError } from "rxjs/operators";
import { IAPIResponse } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";

@Injectable({
  providedIn: "root",
})
export class ActivityLogsService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = environment.apiUrl;
  }

  public fetch(query?: { title: string }): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/activity-logs`, query).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }
}
