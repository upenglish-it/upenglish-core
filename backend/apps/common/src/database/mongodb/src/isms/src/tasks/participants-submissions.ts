import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
import { Accounts } from '../accounts';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { Tasks } from '.';
import { Classes } from '../classes';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: 'tasks-submissions' } })
export class TasksSubmissions {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public participant: Accounts;

  @Prop({ type: Object, required: true })
  public task: Tasks;

  /**
   * @reviewed all answers was reviewed
   * @pending all answers is waiting to be review
   * @incomplete questions was not completed by attendee
   * */
  @Prop({ type: String, required: true, default: 'incomplete' })
  public status: 'reviewed' | 'pending' | 'incomplete';

  @Prop({ type: String, required: true })
  public type: 'training' | 'official';

  @Prop({ ref: () => Classes, type: String, default: null })
  public class: Classes;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}
