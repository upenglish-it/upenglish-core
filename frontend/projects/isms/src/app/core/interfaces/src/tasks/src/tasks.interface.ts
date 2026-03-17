import { IAccount } from "../../account/account.interface";
import { TaskSubmission } from "./tasks-submissions.interface";

export interface Task {
  _id: string;
  generalInfo: GeneralInfo;
  assignee: Assignee;
  categories: Array<TaskCategory>;
  mode: "training" | "official";
  course: string;
  class: string;
  status: "published" | "unpublished";
  type: "training" | "official";
  createdBy: IAccount;
  createdAt: string;
  updatedAt: string;

  // added in FE
  submissions?: Array<TaskSubmission>;
}

export interface GeneralInfo {
  type: "homework" | "challenge";
  title: string;
  passing: number;
  instances: number;
  duration: Duration;
  expand: boolean;
}

export interface Assignee {
  reviewers: string[];
  participants: Array<{ id: string; type: "class" | "student" }>;
  expand: boolean;
}

export interface Duration {
  noExpiration: boolean;
  value: 0;
  type: "minute" | "hour" | "month" | "year";
}

export interface TaskCategory {
  id: string;
  title: string;
  points: number;
  questions: Array<TaskQuestion>;
}

export interface TaskQuestion {
  id: string;
  title: string;
  description: string;
  type: "choices" | "fill-in";
  choices: Array<TaskQuestionChoice>;
  originalAnswer: string; // id if choices or text if fill-in
  attendeeAnswer: string; // id if choices or text if fill-in

  fillInScore: number; // use for type=fill-in. Total points
  check: string; // if enable, chatgpt will review the attendee answer
  // enableOpenAI: boolean; // if enable, chatgpt will review the attendee answer
  reviewerAnswer: string; // a placeholder only use for answer of reviewer
  conclusion: string; // contain an explanation and reason of reviewer on the attendee answer (it can be AI/teacher)

  reviewerScore: number; // the score of reviewer
  // attendeeScore: number; // the computed score as per the reviewer score
  reviewStatus: "completed" | "pending";

  expand: boolean;
}

interface TaskQuestionChoice {
  id: string;
  value: string;
}
