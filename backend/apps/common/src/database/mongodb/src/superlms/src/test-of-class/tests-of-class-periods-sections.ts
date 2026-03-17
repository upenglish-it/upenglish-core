import { Prop, modelOptions } from '@typegoose/typegoose';
import { Accounts, Properties, PropertiesBranches } from '../../../isms';
import { SYSTEM_ID } from 'apps/common/src/utils';

export const IELTSTestsOfClassPeriodsSectionsCN = 'ielts-tests-of-class-periods-sections';
@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: IELTSTestsOfClassPeriodsSectionsCN } })
export class IELTSTestsOfClassPeriodsSections {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  @Prop({ type: String, required: true })
  public name: string;

  @Prop({ type: String, required: true })
  public class: string;

  @Prop({ type: Boolean, default: false })
  public completed: boolean;

  @Prop({ type: String, required: true })
  public type: 'assignment' | 'test';

  @Prop({ type: String, required: true })
  public testsOfClassPeriodId: string;

  @Prop({ type: String, required: true })
  public testsOfClassId: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}
