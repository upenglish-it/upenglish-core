import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IAPIResponse } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";
import { ApiService } from "../../api.service";

@Injectable({
  providedIn: "root",
})
export class SchedulesShiftsService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/schedules/shifts`;
  }

  public fetch(query?: { limit?: number; skip?: number; status?: string; branches?: Array<string> }): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}`);
  }

  public fetchById(id: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/by-id/${id}`);
  }

  public create(body: any): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}`, body);
  }

  public updateById(body: any, id: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/${id}`, body);
  }

  public delete(id: string): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.#apiUrl}/${id}`);
  }

  public fetchByStaff(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/staff`);
  }

  public fetchAssignedShiftToTeacher(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/teacher/assigned`);
  }

  public teacherManageShift<T>(body: T): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/teacher/manage`, body);
  }

  public teacherManageLessonDetails<T>(body: T): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/teacher/manage/lesson-details`, body);
  }
}
