import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IAPIResponse } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";
import { ApiService } from "../../api.service";

@Injectable({
  providedIn: "root",
})
export class ClassesService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/classes`;
  }

  public fetch(query?: { limit?: number; skip?: number; status?: string; name?: string; showTotalMembers?: boolean; assignedToMe?: boolean }): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}`, query);
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

  public breakdown(query: { studentId: string }): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/breakdown`, query);
  }

  public fetchStudentClasses(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/student-classes`);
  }

  // public fetchById(id: string): Observable<IAPIResponse> {
  //   return this.apiService.get(`${this.#apiUrl}/${id}`);
  // }

  // public update(data: any, id: string): Observable<IAPIResponse> {
  //   return this.apiService.patch(`${this.#apiUrl}/${id}`, data);
  // }

  // public addTags(body: { studentIds: Array<string>; tags: Array<string> }): Observable<IAPIResponse> {
  //   return this.apiService.put(`${this.#apiUrl}/add-tags`, body);
  // }

  // public addSources(body: { studentIds: Array<string>; sources: Array<string> }): Observable<IAPIResponse> {
  //   return this.apiService.put(`${this.#apiUrl}/add-sources`, body);
  // }

  // public create(body: any): Observable<IAPIResponse> {
  //   return this.apiService.post(`${this.#apiUrl}`, {
  //     ...body,
  //     createdFrom: "manual"
  //   });
  // }

  // public bulkCreate(body: any): Observable<IAPIResponse> {
  //   return this.apiService.post(`${this.#apiUrl}/bulk`, {
  //     ...body,
  //     createdFrom: "csv"
  //   });
  // }

  public enroll(body: { studentClassId?: string; classId: string; studentId: string; dates: Array<any> }): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/enroll`, body);
  }

  public setVersion(studentClassId: string, body: { versionId: string }): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/set-version/${studentClassId}`, body);
  }

  public stopLearning(
    body: { classId: string; studentId: string; action: "request" | "confirmed"; reason: string; stoppedDate: string },
    studentClassId: string
  ): Observable<IAPIResponse> {
    return this.apiService.patch(`${this.#apiUrl}/stop-learning/${studentClassId}`, body);
  }

  public stopLearningAccumulated(query: { studentId: string; date: string }, studentClassId: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/stop-learning-accumulated/${studentClassId}`, query);
  }

  public markAttendance(body: { records: Array<any> }): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/mark-attendance`, body);
  }

  public attendanceStudents(query: { classId: string; date: string; assignedToTeacher?: boolean; limit?: number; page?: number }): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/attendance/students`, query);
  }

  public tuitionStudents(query?: { classId: string; date: string; amount: string; page?: number; limit?: number }): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/tuition/students`, query);
  }

  public pricing(body: any): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/pricing`, body);
  }

  public studentClassDebts(studentId: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/student-class-debts`, { studentId });
  }

  public savingsBreakdown(studentId: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/savings-breakdown/${studentId}`);
  }

  public savings(studentId: string): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/savings/${studentId}`);
  }

  public refund(body: { amount: number; studentId: string }): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/refund`, body);
  }

  public fetchDraftTuition(query: { classes: string }): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/draft-tuition/students`, query);
  }

  public saveDraftTuition(body: { name: string; classes: string; data: any }): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/draft-tuition/students`, body);
  }

  public deleteDraftTuition(draftId: string): Observable<IAPIResponse> {
    return this.apiService.delete(`${this.#apiUrl}/draft-tuition/students/${draftId}`);
  }
}
