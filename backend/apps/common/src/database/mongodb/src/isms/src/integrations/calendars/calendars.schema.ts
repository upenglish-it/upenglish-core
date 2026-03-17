import { Prop, modelOptions } from '@typegoose/typegoose';
import { Properties } from '../../properties';
import { PropertiesBranches } from '../../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { Integrations } from '..';
import { Accounts } from '../../accounts';
import { IMicrosoftCalendar } from 'apps/common/src/interfaces';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'calendars' } })
export class Calendars {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: Object, default: null })
  public data: IMicrosoftCalendar;

  @Prop({ type: String, default: null })
  public provider: 'microsoft';

  @Prop({ type: Object, default: null })
  public meta: {
    insync: boolean;
    microsoftWatch: IMicrosoftCalendarWatch;
  };

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly accounts: Accounts;

  @Prop({ ref: () => Integrations, type: String, required: true })
  public integrations: Integrations;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}

interface IMicrosoftCalendarWatch {
  expiration: string;
  id: string;
  kind: string;
  resourceId: string;
  resourceUri: string;
  token: string;
  tokenExpiration: string;
}
