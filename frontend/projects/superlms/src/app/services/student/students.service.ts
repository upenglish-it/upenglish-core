import { Injectable } from "@angular/core";
import { environment } from "@superlms-environment/environment";
import { ApiService } from "@superlms/shared/services/api/api.service";

@Injectable({
  providedIn: "root",
})
export class StudentsService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/tests-of-class`;
  }

  public studentPendingReview() {
    return this.apiService.apiGet<{ totalPendingReviews: number }>(`${this.#apiUrl}/students/pending-reviews`);
  }
}
