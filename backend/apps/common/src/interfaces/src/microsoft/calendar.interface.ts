export interface IMicrosoftCalendars {
  value: Array<IMicrosoftCalendar>;
}

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
  allowedOnlineMeetingProviders: Array<'teamsForBusiness'>;
  defaultOnlineMeetingProvider: 'teamsForBusiness';
  isTallyingResponses: boolean;
  isRemovable: boolean;
  owner: {
    name: string;
    address: string;
  };
}

export interface IMicrosoftCalendarEvents {
  '@odata.context': string;
  value: Array<IMicrosoftCalendarEvent>;
  '@odata.nextLink': string;
}

export interface IMicrosoftCalendarEvent {
  id: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  changeKey: string;
  categories: Array<any>;
  transactionId: string;
  originalStartTimeZone: string;
  originalEndTimeZone: string;
  iCalUId: string;
  reminderMinutesBeforeStart: number;
  isReminderOn: boolean;
  hasAttachments: boolean;
  subject: string;
  bodyPreview: string;
  importance: string;
  sensitivity: string;
  isAllDay: boolean;
  isCancelled: boolean;
  isOrganizer: boolean;
  responseRequested: boolean;
  seriesMasterId: any;
  showAs: string;
  type: 'seriesMaster' | 'singleInstance';
  webLink: string;
  onlineMeetingUrl: any;
  isOnlineMeeting: boolean;
  onlineMeetingProvider: string;
  allowNewTimeProposals: boolean;
  occurrenceId: any;
  isDraft: boolean;
  hideAttendees: boolean;
  responseStatus: {
    response: string;
    time: string;
  };
  body: {
    contentType: 'html';
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location: {
    displayName: string;
    locationType: 'default';
    uniqueId: string;
    uniqueIdType: 'private';
    address: any;
    coordinates: any;
  };
  locations: Array<any>;
  recurrence: {
    pattern: {
      type?: TMicrosoftCalendarEventRecurrencePatternType;
      interval?: number;
      month?: number;
      dayOfMonth?: number;
      daysOfWeek?: Array<TMicrosoftCalendarEventRecurrencePatternDaysOfWeek>;
      firstDayOfWeek?: 'sunday';
      index?: 'first';
    };
    range: {
      type?: TMicrosoftCalendarEventRecurrenceRangeType;
      startDate?: string;
      endDate?: string;
      recurrenceTimeZone?: string;
      numberOfOccurrences?: number;
    };
  };
  attendees: Array<{
    type: 'required' | 'optional';
    status: {
      response: 'none' | 'accepted' | 'tentativelyAccepted' | 'declined';
      time: string;
    };
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  organizer: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  onlineMeeting: any;
}

export type TMicrosoftCalendarEventRecurrencePatternType = 'daily' | 'weekly' | 'absoluteMonthly' | 'relativeMonthly' | 'absoluteYearly' | 'relativeYearly';
export type TMicrosoftCalendarEventRecurrencePatternDaysOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type TMicrosoftCalendarEventRecurrenceRangeType = 'noEnd' | 'endDate';
