import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IAPIResponse } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";
import { ApiService } from "../../api.service";

@Injectable({
  providedIn: "root",
})
export class StudentsService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/students`;
  }

  public fetch(query?: { page?: number; limit?: number; skip?: number; status?: string; name?: string; branches?: Array<string>; customQuery?: any }): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}`, query);
  }

  public fetchById(id: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/${id}`);
  }

  public update(data: any, id: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/${id}`, data);
  }

  public addTags(body: { studentIds: Array<string>; tags: Array<string> }): Observable<IAPIResponse> {
    return this.apiService.put(`${this.#apiUrl}/add-tags`, body);
  }

  public addSources(body: { studentIds: Array<string>; sources: Array<string> }): Observable<IAPIResponse> {
    return this.apiService.put(`${this.#apiUrl}/add-sources`, body);
  }

  public create(body: any): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}`, {
      ...body,
      createdFrom: "manual",
    });
  }

  public bulkCreate(body: any): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/bulk`, {
      ...body,
      createdFrom: "csv",
    });
  }

  public manage(payload: {
    action:
      | "delete"
      | "add-tag"
      | "send-email"
      | "add-task"
      | "disqualify"
      | "requalify"
      | "add-to-pipeline-with-pipeline-stage"
      | "remove-from-pipeline-with-pipeline-stage"
      | "remove-from-pipelines"
      | "add-to-pipeline"
      | "add-source";
    pipeline?: { pipelineIds: Array<string>; pipelineStageId?: string };
    leadIds: Array<string>;
  }): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/manage`, payload);
  }
}
