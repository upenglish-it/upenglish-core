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

  @Prop({ type: Date, required: true })
  public readonly startDate: Date;

  @Prop({ type: Date, required: true })
  public readonly endDate: Date;

  @Prop({ type: Number, required: true })
  public readonly graceDays: number;

  @Prop({ type: Date, required: true })
  public readonly dataStartDate: Date;

  @Prop({ type: Date, required: true })
  public readonly dataEndDate: Date;

  @Prop({ type: Date, required: true })
  public readonly ratingStartDate: Date;

  @Prop({ type: Date, required: true })
  public readonly ratingEndDate: Date;

  @Prop({ type: Boolean, required: true })
  public readonly autoCreated: boolean;

  @Prop({ type: Date, required: true })
  public readonly deletedAt: Date;

  @Prop({ type: Boolean, required: true })
  public readonly deleted: boolean;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
