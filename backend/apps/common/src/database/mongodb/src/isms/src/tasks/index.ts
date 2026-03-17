import { Prop, modelOptions } from '@typegoose/typegoose';
import { Accounts } from '../accounts';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'tasks' } })
export class Tasks {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  @Prop({ type: Object, required: true })
  public generalInfo: TaskGeneralInfo;

  @Prop({ type: Object, required: true })
  public assignee: TaskAssignee;

  @Prop({ type: Array, default: [] })
  public categories: Array<TaskCategory>;

  @Prop({ type: String, required: true, default: 'unpublished' })
  public status: TaskStatus;

  @Prop({ type: String, required: true, default: 'training' })
  public mode: TaskMode;

  @Prop({ type: String, required: false, default: null })
  public course: string;

  @Prop({ type: String, required: false, default: null })
  public class: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}

export interface TaskGeneralInfo {
  type: 'homework' | 'challenge';
  title: string;
  passing: number;
  instances: number;
  duration: TaskDuration;
}

export interface TaskAssignee {
  reviewers: Array<string>;
  participants: Array<{ id: string; type: 'class' | 'student' }>;
  expand: boolean;
}

export interface TaskDuration {
  noExpiration: boolean;
  value: 0;
  type: 'minute' | 'hour' | 'month' | 'year';
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
  type: 'choices' | 'fill-in';
  choices: Array<TaskQuestionChoice>;
  // fillIn: string;
  originalAnswer: string; // id if choices or text if fill-in
  attendeeAnswer: string; // id if choices or text if fill-in

  // fillInScore: number; // use for type=fill-in. Total points
  // enableOpenAI: boolean; // if enable, chatgpt will review the attendee answer
  check: 'none' | 'short-answer' | 'grammar-vocab-check' | 'long-answer'; // ways of checking
  reviewerAnswer: string; // answer of reviewer
  conclusion: string; // contain an explanation and reason of reviewer on the attendee answer (it can be AI/teacher)

  reviewerScore: number; // the score of reviewer
  attendeeScore: number; // the computed score as per the reviewer score
  reviewStatus: 'completed' | 'pending';
}

interface TaskQuestionChoice {
  id: string;
  value: string;
}

export type TaskStatus = 'published' | 'unpublished';
export type TaskMode = 'training' | 'official';
