import { Injectable } from "@angular/core";
import { Task } from "@isms-core/interfaces";
import { Subject } from "rxjs";

@Injectable({ providedIn: "root" })
export class TasksSubjectService {
  private subject = new Subject<TaskSubject>();

  public send(data: TaskSubject): void {
    this.subject.next(data);
  }

  public received() {
    return this.subject.asObservable();
  }
}

export interface TaskSubject {
  type: "default" | "updated";
  data: Task;
}
