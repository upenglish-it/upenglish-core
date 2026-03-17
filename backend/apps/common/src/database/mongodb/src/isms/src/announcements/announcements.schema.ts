import { Prop, modelOptions, Ref } from '@typegoose/typegoose';
import { Accounts } from '../accounts';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { Classes } from '../classes';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'announcements' } })
export class Announcements {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: String, required: true })
  public title: string;

  @Prop({ type: String, required: true })
  public message: string;

  @Prop({ ref: () => Array<Accounts>, type: Array, required: true })
  public participants: Array<string>;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public createdBy: Accounts;

  @Prop({ ref: () => Classes, type: String, required: true })
  public classes: Classes;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, default: false })
  public verified: boolean;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}
