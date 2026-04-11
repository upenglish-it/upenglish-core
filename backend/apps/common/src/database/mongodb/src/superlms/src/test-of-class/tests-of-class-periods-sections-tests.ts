import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
import { Accounts, Properties, PropertiesBranches } from '../../../isms';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { IELTSTasks } from '../tasks';

export const IELTSTestsOfClassPeriodsSectionsTestsCN = 'ielts-tests-of-class-periods-sections-tests';
@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: IELTSTestsOfClassPeriodsSectionsTestsCN } })
export class IELTSTestsOfClassPeriodsSectionsTests {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  @Prop({ type: String, required: true })
  public class: string;

  @Prop({ type: Object, required: true })
  public test: IELTSTasks;

  @Prop({ type: String, required: true })
  public testsOfClassPeriodSectionId: string;

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
