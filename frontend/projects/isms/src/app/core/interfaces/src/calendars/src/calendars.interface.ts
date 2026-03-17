// import { ISchedule } from "../../schedule";

export interface IIntegration {
  _id: string;
  company: "microsoft";
  data: {
    application: "calendar";
    info: {
      mail: string;
      userPrincipalName: string;
    };
    sync: boolean;
    status: "synching" | "completed" | "failed";
    syncDirection: "one-way" | "two-way";
  };
  calendars: Array<ICalendar>;

  // added in FE
  expand?: boolean;
}

export interface ICalendar {
  _id: string;
  // data: {
  //   id: string;
  //   name: string;
  //   canEdit: boolean;
  //   isDefaultCalendar: boolean;
  // };
  data: IMicrosoftCalendar;
  provider: "microsoft";
  meta: { insync: boolean };

  // added in FE
  selected?: boolean;
}

// export interface ICalendarEvent {
//   _id: string;
//   title: string;
//   description: string;
//   location: string;
//   reminder: ICalendarEventReminder;
//   schedule: ISchedule;
//   attendees: [];
//   meta: {
//     providerCalendarId: string;
//     providerEventId: string;
//     createdFrom: "microsoft";
//   };
//   accounts: string;
//   calendars: ICalendar;
//   properties: string;
//   propertiesBranches: string;
//   deleted: false;
//   createdAt: string;
//   updatedAt: string;
// }

// export interface ICalendarEventReminder {
//   enable: boolean;
//   prior: "before" | "after";
//   span: "hours" | "minutes" | "days" | "weeks";
//   duration: number;
// }

export interface IMicrosoftCalendar {
  id: string;
  name: string;
  color: string;
  hexColor: string;
  isDefaultCalendar: boolean;
  changeKey: string;
  canShare: boolean;
  canViewPrivateItems: boolean;
  canEdit: boolean;
  allowedOnlineMeetingProviders: Array<"teamsForBusiness">;
  defaultOnlineMeetingProvider: "teamsForBusiness";
  isTallyingResponses: boolean;
  isRemovable: boolean;
  owner: {
    name: string;
    address: string;
  };
}
