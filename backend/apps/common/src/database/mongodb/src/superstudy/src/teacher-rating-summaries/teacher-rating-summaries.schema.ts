// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTTeacherRatingSummariesCN = 'sst-teacher-rating-summaries';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: SSTTeacherRatingSummariesCN } })
export class SSTTeacherRatingSummaries {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly periodId: string;

  @Prop({ type: String, required: true })
  public readonly teacherId: string;

  @Prop({ type: String, required: true })
  public readonly teacherName: string;

  @Prop({ type: Number, required: true })
  public readonly totalResponses: number;

  @Prop({ type: Object, required: true })
  public readonly averageScores: Record<string, any>;

  @Prop({ type: Number, required: true })
  public readonly overallScore: number;

  @Prop({ type: String, required: true })
  public readonly aiSummary: string;

  @Prop({ type: Object, default: {} })
  public readonly groupScores?: Record<string, any>;

  @Prop({ type: String, required: true })
  public readonly generatedAt: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
