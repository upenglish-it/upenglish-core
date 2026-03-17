import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IAPIResponse } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";
import { ApiService } from "../../api.service";
import { QueryParams } from "@isms-core/types";

@Injectable({ providedIn: "root" })
export class CashflowExpenseService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/cashflow/expenses`;
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
