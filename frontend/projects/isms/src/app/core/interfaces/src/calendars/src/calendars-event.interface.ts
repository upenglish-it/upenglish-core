import { ISchedule } from "../../schedule";
import { ICalendar } from "./calendars.interface";

export interface ICalendarEvent {
  _id: string;
  title: string;
  description: string;
  location: string;
  reminder: ICalendarEventReminder;
  schedule: ISchedule;
  attendees: Array<ICalendarEventAttendee>;
  organizer: {
    accountId: string;
    name: string;
    emailAddress: string;
  };
  meta: {
    providerCalendarId: string;
    providerEventId: string;
    createdFrom: "microsoft" | "isms-internally";
  };
  accounts: string;
  integrations: string;
  calendars: ICalendar;
  properties: string;
  propertiesBranches: string;
  deleted: false;
  createdAt: string;
  updatedAt: string;
}

export interface ICalendarEventReminder {
  enable: boolean;
  prior: "before" | "after";
  span: "hours" | "minutes" | "days" | "weeks";
  duration: number;
}

export interface ICalendarEventAttendee {
  accountId: string; // if account is registered in system
  emailAddress: string; // email of any attendee(registered or unregistered)
  name: string; // name of any attendee(registered or unregistered)
  required: boolean; // default=true name of any attendee(registered or unregistered)
  response: ICalendarEventAttendeeResponse; // default=unknown name of any attendee(registered or unregistered)
  profilePhoto: string;
}

export type ICalendarEventAttendeeResponse = "none" | "accepted" | "tentative" | "declined";
