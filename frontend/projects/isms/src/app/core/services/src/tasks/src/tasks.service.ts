import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IAPIResponse, Task } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";
import { ApiService } from "../../api.service";

@Injectable({ providedIn: "root" })
export class TasksService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/tasks`;
  }

  public fetch(query?: { limit?: number; skip?: number; status?: string; branches?: Array<string> }): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}`);
  }

  public fetchById(id: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/${id}`);
  }

  public create<T>(body: T): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}`, body);
  }

  public updateBuilderById<T>(body: T, id: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/${id}/builder`, body);
  }

  public updateSettingsById<T>(body: T, id: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/${id}/settings`, body);
  }

  public assigneeParticipants(id: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/${id}/assignee/participants`);
  }

  public manageParticipantInstance<T>(id: string, body: { ids: string[]; type: string }): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.#apiUrl}/${id}/assignee/participants/manage-instances`, body);
  }

  public fetchParticipantInstance(taskId: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/${taskId}/assignee/participants/manage-instances`);
  }

  public participantTasks(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/participant/tasks`);
  }

  public participantSubmissions(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/submissions/participant/submissions`);
  }

  public reports(query: any): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/submissions/reports`, query);
  }

  public delete(id: string): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.#apiUrl}/${id}`);
  }

  public copyToBranch(branchId: string, taskId: string): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/copy-to-branch/${branchId}/${taskId}`);
  }

  public importCSV<T>(body: { records: Partial<Task>[] }): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/import-csv`, body);
  }
}
