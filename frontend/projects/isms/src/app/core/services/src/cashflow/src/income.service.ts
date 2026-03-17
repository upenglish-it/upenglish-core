import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "../../api.service";
import { environment } from "@isms-env/environment";
import { IAPIResponse } from "@isms-core/interfaces";
import { QueryParams } from "@isms-core/types";

@Injectable({ providedIn: "root" })
export class CashflowIncomeService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/cashflow/income`;
  }

  public fetch(query?: QueryParams): Observable<IAPIResponse> {
    return this.apiService.get(this.#apiUrl, query);
  }

  public fetchByTransactionId(transactionId: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/by-transaction/${transactionId}`);
  }

  public create(body: any): Observable<IAPIResponse> {
    return this.apiService.post(this.#apiUrl, body);
  }

  public delete(id: string): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.#apiUrl}/${id}`);
  }
}
