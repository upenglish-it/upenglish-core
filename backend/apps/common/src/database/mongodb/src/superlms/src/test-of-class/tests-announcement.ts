import { Prop, modelOptions } from '@typegoose/typegoose';
import { Accounts, Properties, PropertiesBranches } from '../../../isms';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { IELTSTestsOfClass } from './tests-of-class';

export const IELTSTestsAnnouncementCN = 'ielts-tests-announcements';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: IELTSTestsAnnouncementCN } })
export class IELTSTestsAnnouncements {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  @Prop({ type: String, required: true })
  public title: string;

  @Prop({ type: String, required: true })
  public message: string;

  @Prop({ type: String, required: true })
  public class: string;

  @Prop({ type: String, required: true })
  public student: string;

  @Prop({ ref: () => IELTSTestsOfClass, type: String, required: true })
  public testsOfClass: IELTSTestsOfClass;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}
