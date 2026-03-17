import { Prop, Severity, modelOptions } from '@typegoose/typegoose';
import { Accounts } from '../../accounts';
import { Properties } from '../../properties';
import { PropertiesBranches } from '../../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { Calendars } from './calendars.schema';
import { IMicrosoftCalendarEvent } from 'apps/common/src/interfaces';
import { Integrations } from '..';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'calendars-events' }, options: { allowMixed: Severity.ALLOW } })
export class CalendarsEvents {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: Object, default: null })
  public data: IMicrosoftCalendarEvent;

  @Prop({ type: String, default: null })
  public title: string;

  @Prop({ type: String, default: null })
  public description: string;

  @Prop({ type: String, default: null })
  public location: string;

  @Prop({ type: Object, default: null })
  public reminder: IEventReminder;

  @Prop({ type: Object, required: true })
  public schedule: IEventSchedule;

  @Prop({ type: Array, default: [] })
  public attendees: Array<IEventAttendee>;

  @Prop({ type: Object, required: true })
  public organizer: IEventOrganizer;

  @Prop({ type: Object, required: true })
  public meta: IEventMeta;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public accounts: Accounts;

  @Prop({ ref: () => Calendars, type: String, required: true })
  public calendars: Calendars;

  @Prop({ ref: () => Integrations, type: String, required: true })
  public integrations: Integrations;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}

export interface IEventSchedule {
  fromDateTime?: string; // use in microsoft
  fromDate: string;
  fromTime: string;
  fromTimezone: string;
  toDateTime?: string; // use in microsoft
  toDate: string;
  toTime: string;
  toTimezone: string;
  allDay: boolean;
  recurrence: IEventScheduleRecurrence;
}

export interface IEventAttendee {
  accountId: string; // if account is registered in system
  emailAddress: string; // email of any attendee(registered or unregistered)
  name: string; // name of any attendee(registered or unregistered)
  required: boolean; // default=true name of any attendee(registered or unregistered)
  response: IEventAttendeeResponse; // default=unknown name of any attendee(registered or unregistered)
  profilePhoto: string;
}

export interface IEventOrganizer {
  accountId: string;
  name: string;
  emailAddress: string;
}

export interface IEventScheduleRecurrence {
  enable: boolean;
  value: string;
  freq: number;
  interval: number;
  byweekday: Array<number>;
  bymonth: Array<number>;
  ends: IEventScheduleRecurrenceEnds;
}
export interface IEventScheduleRecurrenceEnds {
  type: 'never' | 'on' | 'after';
  endDate: string;
  count: number;
}
export interface IEventReminder {
  enable: boolean;
  prior: 'before' | 'after';
  span: 'hours' | 'minutes' | 'days' | 'weeks';
  duration: number;
}

export interface IEventMeta {
  providers: Array<{
    provider: 'microsoft' | 'google';
    calendarId: string; // microsoft/google calendarId
    eventId: string; // microsoft/google calendar eventId
  }>;
  createdFrom: 'microsoft' | 'isms-internally';
}

export type IEventAttendeeResponse = 'none' | 'accepted' | 'tentative' | 'declined';
