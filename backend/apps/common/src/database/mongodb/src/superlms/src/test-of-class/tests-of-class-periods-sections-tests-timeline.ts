import { Prop, modelOptions } from '@typegoose/typegoose';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { IELTSTasks } from '../tasks';
import { IELTSTestsOfClassPeriodsSections } from './tests-of-class-periods-sections';

export const IELTSTestsOfClassPeriodsSectionsTestsTimelineCN = 'ielts-tests-of-class-periods-sections-tests-timeline';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: IELTSTestsOfClassPeriodsSectionsTestsTimelineCN } })
export class IELTSTestsOfClassPeriodsSectionsTestsTimeline {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  @Prop({ type: String, required: true })
  public type: 'test' | 'note';

  @Prop({ type: Array, default: [] })
  public tests: IELTSTasks[];

  @Prop({ type: Object, default: null })
  public periodsSection: typeof IELTSTestsOfClassPeriodsSections;

  @Prop({ type: String, default: null })
  public notes: string;

  @Prop({ type: String, required: true })
  public class: string;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}
