import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IAPIResponse } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";
import { ApiService } from "../../api.service";

@Injectable({ providedIn: "root" })
export class TasksSubmissionsService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/tasks/submissions`;
  }

  public fetchParticipantsSubmissions(taskId: string, query?: { limit?: number; skip?: number; status?: string; branches?: Array<string> }): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/participants/${taskId}`);
  }

  public fetchById(id: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/task/${id}`);
  }

  public create<T>(body: T): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/participant`, body);
  }

  public updateCategoriesById<T>(body: T, id: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/participant/categories/${id}`, body);
  }

  public reviewParticipantAnswer<T>(id: string, body?: T): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/participant/review-answer/${id}`, body);
  }

  public participantSubmissions(id: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/participant/submissions/${id}`);
  }

  // public participantTasks(): Observable<IAPIResponse> {
  //   return this.apiService.get(`${this.#apiUrl}/participant/tasks`);
  // }

  public delete(id: string): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.#apiUrl}/participant/submissions/${id}`);
  }
}
