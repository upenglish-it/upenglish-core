import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "../../api.service";
import { environment } from "@isms-env/environment";
import { IAPIResponse } from "@isms-core/interfaces";

@Injectable({
  providedIn: "root",
})
export class PipelinesService {
  private apiUrl: string;

  constructor(private apiService: ApiService) {
    this.apiUrl = `${environment.apiUrl}/pipelines`;
  }

  public fetch(): Observable<IAPIResponse> {
    return this.apiService.get(this.apiUrl);
  }

  public create(body: { title: string; type: "leads" | "task" }): Observable<IAPIResponse> {
    return this.apiService.post(this.apiUrl, body);
  }

  public fetchById(pipelineId: string, type: "leads" | "task"): Observable<IAPIResponse> {
    return this.apiService.get(`${this.apiUrl}/${pipelineId}?type=${type}`);
  }

  public fetchAssignedCandidates(pipelineId: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.apiUrl}/${pipelineId}/leads`);
  }

  public clone(body: { title: string; pipelineId: string }): Observable<IAPIResponse> {
    return this.apiService.post(`${this.apiUrl}/clone`, body);
  }

  public update(body: any, pipelineId: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.apiUrl}/${pipelineId}`, body);
  }

  public updateStatus<T>(body: T, pipelineId: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.apiUrl}/${pipelineId}/status`, body);
  }

  public delete(pipelineId: string, type: "leads" | "task"): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.apiUrl}/${pipelineId}?type=${type}`);
  }

  public addStage(
    body: {
      stage: { state: string; type: string; title: string; color: string };
      stages: Array<{ id: string; new: boolean }>;
    },
    pipelineId: string,
    type: "leads" | "task"
  ): Observable<IAPIResponse> {
    return this.apiService.post(`${this.apiUrl}/${pipelineId}/stage`, { ...body, type });
  }

  public removeStage(body: { removePipelineStageId: string; receiverPipelineStageId: string }, pipelineId: string, type: "leads" | "task"): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.apiUrl}/${pipelineId}/stage`, { ...body, type });
  }

  public updateStage(body: { stage: { title: string; color: string } }, pipelineId: string, stageId: string): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.apiUrl}/${pipelineId}/stage/${stageId}`, body);
  }

  public fetchLeadInfo(pipelineId: string, query: { leadId: string }): Observable<IAPIResponse> {
    return this.apiService.get(`${this.apiUrl}/${pipelineId}/lead-info`, query);
  }

  /**
   * Manage tasks in a task-type pipeline (add/move/edit) using ManageTaskInTaskPipelineDTO.
   *
   * Backend DTO:
   *  - stagesIds: { taskId?: string; currentStageId: string; moveToStageId?: string }
   *  - action: 'move' | 'add' | 'edit'
   *  - name: string
   *  - notes?: string
   */
  public manageTaskInTaskPipeline(
    pipelineId: string,
    body: {
      stagesIds: { taskId?: string; currentStageId: string; moveToStageId?: string };
      action: "move" | "add" | "edit";
      name: string;
      notes?: string | null;
    }
  ): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.apiUrl}/${pipelineId}/task`, body);
  }

  /**
   * Delete/remove an existing task from a task-type pipeline using DeleteTaskInTaskPipelineDTO.
   *
   * Backend DTO:
   *  - taskId: string
   */
  public deleteTaskInTaskPipeline(pipelineId: string, taskId: string): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.apiUrl}/${pipelineId}/task?taskId=${taskId}`);
  }

  /**
   * Convenience wrapper for moving a task to another stage using ManageTaskInTaskPipelineDTO.
   */
  public moveTaskInTaskPipeline(
    pipelineId: string,
    payload: {
      taskId?: string;
      currentStageId: string;
      moveToStageId: string;
      name: string;
      notes?: string | null;
    }
  ): Observable<IAPIResponse> {
    const { taskId, currentStageId, moveToStageId, name, notes } = payload;
    return this.manageTaskInTaskPipeline(pipelineId, {
      stagesIds: {
        taskId,
        currentStageId,
        moveToStageId,
      },
      action: "move",
      name,
      notes: notes ?? null,
    });
  }
}
