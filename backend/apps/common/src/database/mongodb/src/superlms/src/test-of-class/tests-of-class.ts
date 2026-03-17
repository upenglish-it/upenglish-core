import { Prop, modelOptions } from '@typegoose/typegoose';
import { Accounts, Properties, PropertiesBranches } from '../../../isms';
import { SYSTEM_ID } from 'apps/common/src/utils';

export const IELTSTestsOfClassCN = 'ielts-tests-of-class';
@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: IELTSTestsOfClassCN } })
export class IELTSTestsOfClass {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  @Prop({ type: String, default: 'draft' })
  public status: 'draft' | 'published';

  @Prop({ type: String, default: '' })
  public description: string;

  @Prop({ type: String, required: true })
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
