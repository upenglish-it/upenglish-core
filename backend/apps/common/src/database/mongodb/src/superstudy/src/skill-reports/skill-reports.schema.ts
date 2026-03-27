const SkillReportStatusC = ['draft', 'sent'] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTSkillReportsCN = 'sst-skill-reports';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTSkillReportsCN } })
export class SSTSkillReports {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly studentId: string;

  @Prop({ type: String, required: true })
  public readonly groupId: string;

  @Prop({ type: String, required: true })
  public readonly teacherId: string;

  @Prop({ type: String, required: true })
  public readonly startDate: string;

  @Prop({ type: String, required: true })
  public readonly endDate: string;

  @Prop({ type: Object, required: true })
  public readonly skillData: Record<string, any>;

  @Prop({ type: Object, required: true })
  public readonly aiReport: Record<string, any>;

  @Prop({ type: Object, required: true })
  public readonly finalReport: Record<string, any>;

  @Prop({ type: String, enum: SkillReportStatusC, required: true })
  public readonly status: SkillReportStatusT;

  @Prop({ type: Date, default: null })
  public readonly sentAt: Date;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

/**
 * @interface     SkillReportStatusT
 * @description   Skill Report Status Type
 */
export type SkillReportStatusT = (typeof SkillReportStatusC)[number];
