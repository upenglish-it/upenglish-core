const ExamTypesC = [] as const;
const TargetLevelsC = [] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTExamsCN = 'sst-exams';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTExamsCN } })
export class SSTExams {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, required: true })
  public readonly description: string;

  @Prop({ type: String, required: true })
  public readonly icon: string;

  @Prop({ type: Number, required: true })
  public readonly color: number;

  @Prop({ type: Number, required: true })
  public readonly timeLimitMinutes: number;

  @Prop({ type: String, required: true })
  public readonly timingMode: string;

  @Prop({ type: Array, required: true })
  public readonly sections: string[];

  @Prop({ type: Boolean, required: true })
  public readonly public: boolean;

  @Prop({ type: String, required: true })
  public readonly cefrLevel: string;

  @Prop({ type: String, enum: ExamTypesC, required: true })
  public readonly examType: ExamTypesT;

  @Prop({ type: String, required: true })
  public readonly teacherTitle: string;

  @Prop({ type: String, required: true })
  public readonly studentTitle: string;

  @Prop({ type: Number, required: true })
  public readonly cachedQuestionTimeMissingCount: number;

  @Prop({ type: Number, required: true })
  public readonly cachedQuestionCount: number;

  @Prop({ type: Number, required: true })
  public readonly cachedQuestionTimeTotalSeconds: number;

  @Prop({ type: String, default: null })
  public readonly deletedAt: string;

  @Prop({ type: Boolean, required: true })
  public readonly owner: boolean;

  @Prop({ type: Boolean, required: true })
  public readonly admin: boolean;

  @Prop({ type: String, default: null })
  public readonly duplicatedFrom: string;

  @Prop({ type: Array, required: true })
  public readonly collaborators: string[];

  @Prop({ type: String, required: true })
  public readonly title: string;

  @Prop({ type: String, required: true })
  public readonly copiedFrom: string;

  @Prop({ type: String, required: true })
  public readonly proposedBy: string;

  @Prop({ type: Array, required: true })
  public readonly proposedByName: string[];

  @Prop({ type: String, required: true })
  public readonly teacherGender: string;

  @Prop({ type: Number, required: true })
  public readonly maxTotalScore: number;

  @Prop({ type: Boolean, required: true })
  public readonly archived: boolean;

  @Prop({ type: String, required: true })
  public readonly transferredAt: string;

  @Prop({ type: String, required: true })
  public readonly transferredToName: string;

  @Prop({ type: String, enum: TargetLevelsC, required: true })
  public readonly targetLevel: TargetLevelsT;

  @Prop({ type: String, required: true })
  public readonly targetAge: string;

  @Prop({ type: String, default: null })
  public readonly convertedFrom: string;

  @Prop({ type: String, default: null })
  public readonly restoredAt: string;

  @Prop({ type: String, default: null })
  public readonly restoredFromTeacher: string;

  @Prop({ type: Array, required: true })
  public readonly collaboratorNames: string[];

  @Prop({ type: Array, required: true })
  public readonly collaboratorIds: string[];

  @Prop({ type: Array, required: true })
  public readonly collaboratorRoles: string[];

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: true })
  public readonly deleted: boolean;
}

/**
 * @interface     ExamTypesT
 * @description   Exam Types Type
 */
export type ExamTypesT = (typeof ExamTypesC)[number];

/**
 * @interface     TargetLevelsT
 * @description   Target Levels Type
 */
export type TargetLevelsT = (typeof TargetLevelsC)[number];
