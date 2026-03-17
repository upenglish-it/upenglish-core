import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IAPIResponse } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";
import { ApiService } from "../../api.service";

@Injectable({
  providedIn: "root",
})
export class ProofOfPaymentService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/pop`;
  }

  public fetchStudentReceipt(urlCode: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/student/${urlCode}`);
  }

  public fetchCashflowReceipt(transactionId: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/cashflow/${transactionId}`);
  }

  public fetchStaffPayslip(urlCode: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/staff/${urlCode}`);
  }
}
