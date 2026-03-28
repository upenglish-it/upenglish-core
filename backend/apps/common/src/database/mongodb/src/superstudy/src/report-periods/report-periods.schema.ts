// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTReportPeriodsCN = 'sst-report-periods';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTReportPeriodsCN } })
export class SSTReportPeriods {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly label: string;

  @Prop({ type: String, required: true })
  public readonly startDate: string;

  @Prop({ type: String, required: true })
  public readonly endDate: string;

  @Prop({ type: Number, default: 0 })
  public readonly graceDays: number;

  @Prop({ type: String, default: '' })
  public readonly dataStartDate: string;

  @Prop({ type: String, default: '' })
  public readonly dataEndDate: string;

  @Prop({ type: String, default: '' })
  public readonly ratingStartDate: string;

  @Prop({ type: String, default: '' })
  public readonly ratingEndDate: string;

  @Prop({ type: Boolean, default: false })
  public readonly autoCreated: boolean;

  @Prop({ type: Date, default: null })
  public readonly deletedAt: Date;

  @Prop({ type: Boolean, default: false })
  public readonly isDeleted: boolean;

  @Prop({ ref: () => Accounts, type: String, default: '' })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, default: '' })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, default: '' })
  public readonly propertiesBranches: PropertiesBranches;
}
