export const ToolSubmissionSkillCategoriesC = [''] as const;
export const ToolSubmissionToolSubCategoriesC = [''] as const;
export const ToolSubmissionPracticeModesC = [''] as const;
export const ToolSubmissionStatusC = ['pending', 'submitted', 'graded', 'failed'] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTToolSubmissionsCN = 'sst-tool-submissions';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTToolSubmissionsCN } })
export class SSTToolSubmissions {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly assignmentId: string;

  @Prop({ type: String, required: true })
  public readonly toolId: string;

  @Prop({ type: String, required: true })
  public readonly studentId: string;

  @Prop({ type: String, required: true })
  public readonly groupId: string;

  @Prop({ type: Number, required: true })
  public readonly score: number;

  @Prop({ type: Number, required: true })
  public readonly maxScore: number;

  @Prop({ type: Number, required: true })
  public readonly percentage: number;

  @Prop({ type: Object, required: true })
  public readonly rawResult: Record<string, any>;

  @Prop({ type: String, enum: ToolSubmissionSkillCategoriesC, required: true })
  public readonly skillCategory: ToolSubmissionSkillCategoriesT;

  @Prop({ type: String, enum: ToolSubmissionPracticeModesC, required: true })
  public readonly practiceMode: ToolSubmissionPracticeModesT;

  @Prop({ type: String, enum: ToolSubmissionToolSubCategoriesC, required: true })
  public readonly toolSubCategory: ToolSubmissionToolSubCategoriesT;

  @Prop({ type: String, required: true })
  public readonly startedAt: string;

  @Prop({ type: String, required: true })
  public readonly submittedAt: string;

  @Prop({ type: Number, required: true })
  public readonly duration: number;

  @Prop({ type: Number, required: true })
  public readonly attemptNumber: number;

  @Prop({ type: String, enum: ToolSubmissionStatusC, required: true })
  public readonly status: ToolSubmissionStatusT;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

/**
 * @interface     ToolSubmissionSkillCategoriesT
 * @description   Tool Submission Skill Categories Type
 */
export type ToolSubmissionSkillCategoriesT = (typeof ToolSubmissionSkillCategoriesC)[number];

/**
 * @interface     ToolSubmissionPracticeModesT
 * @description   Tool Submission Practice Modes Type
 */
export type ToolSubmissionPracticeModesT = (typeof ToolSubmissionPracticeModesC)[number];

/**
 * @interface     ToolSubmissionToolSubCategoriesT
 * @description   Tool Submission Tool Sub Categories Type
 */
export type ToolSubmissionToolSubCategoriesT = (typeof ToolSubmissionToolSubCategoriesC)[number];

/**
 * @interface     ToolSubmissionStatusT
 * @description   Tool Submission Status Type
 */
export type ToolSubmissionStatusT = (typeof ToolSubmissionStatusC)[number];
