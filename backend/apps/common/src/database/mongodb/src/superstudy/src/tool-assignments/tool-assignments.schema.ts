export const skillCategoriesC = [''] as const;
export const toolSubCategoriesC = [''] as const;
export const practiceModesC = [''] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTToolAssignmentsCN = 'sst-tool-assignments';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: SSTToolAssignmentsCN } })
export class SSTToolAssignments {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly toolId: string;

  @Prop({ type: String, required: true })
  public readonly toolName: string;

  @Prop({ type: String, enum: skillCategoriesC, required: true })
  public readonly skillCategory: SkillCategoriesT;

  @Prop({ type: String, required: true })
  public readonly groupId: string;

  @Prop({ type: String, required: true })
  public readonly assignedBy: string;

  @Prop({ type: String, required: true })
  public readonly assignedByName: string;

  @Prop({ type: String, enum: practiceModesC, required: true })
  public readonly practiceMode: PracticeModesT;

  @Prop({ type: String, enum: toolSubCategoriesC, required: true })
  public readonly toolSubCategory: ToolSubCategoriesT;

  @Prop({ type: Number, required: true })
  public readonly maxAttempts: number;

  @Prop({ type: Number, required: true })
  public readonly requiredAttempts: number;

  @Prop({ type: [String], required: true })
  public readonly assignedStudentIds: string[];

  @Prop({ type: String, required: true })
  public readonly dueDate: string;

  @Prop({ type: String, required: true })
  public readonly studentDeadlines: string;

  @Prop({ type: Object, required: true })
  public readonly toolConfig: Record<string, any>;

  @Prop({ type: String, required: true })
  public readonly deletedAt: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

/**
 * @interface     SkillCategoriesT
 * @description   Skill Categories Type
 */
export type SkillCategoriesT = (typeof skillCategoriesC)[number];

/**
 * @interface     ToolSubCategoriesT
 * @description   Tool Sub Categories Type
 */
export type ToolSubCategoriesT = (typeof toolSubCategoriesC)[number];

/**
 * @interface     PracticeModesT
 * @description   Practice Modes Type
 */
export type PracticeModesT = (typeof practiceModesC)[number];
