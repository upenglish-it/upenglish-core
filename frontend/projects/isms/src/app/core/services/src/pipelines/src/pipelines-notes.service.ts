import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "../../api.service";
import { environment } from "@isms-env/environment";
import { IAPIResponse } from "@isms-core/interfaces";

@Injectable({
  providedIn: "root",
})
export class PipelinesNotesService {
  private apiUrl: string;

  constructor(private apiService: ApiService) {
    this.apiUrl = `${environment.apiUrl}/pipelines`;
  }

  public create(pipelineId: string, body: { leadIds: Array<string>; title: string; message: string }): Observable<IAPIResponse> {
    return this.apiService.post(`${this.apiUrl}/${pipelineId}/notes`, body);
  }

  public fetch(pipelineId: string, leadId: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.apiUrl}/${pipelineId}/notes/${leadId}`);
  }
}
