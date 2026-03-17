import fetch from 'node-fetch';
import { IMicrosoftCalendarEvent, IMicrosoftCalendarEvents, IMicrosoftCalendars } from 'apps/common/src/interfaces';
import { MICROSOFT_BETA_API, MICROSOFT_ME_API, MICROSOFT_SUBSCRIPTION_API } from 'apps/common/src/constants';
import { isEmpty } from 'lodash';

export const MicrosoftCalendars = async (authToken: string): Promise<IMicrosoftCalendars> => {
  try {
    const response = await fetch(`${MICROSOFT_ME_API}/calendars`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: authToken, 'Content-Type': 'application/json' },
    }).then((res: any) => res.json());
    return response;
  } catch (error) {
    return null;
  }
};

export const MicrosoftCalendarEvents = async (
  authToken: string,
  calendarId: string,
  primaryCalendar: boolean,
  query?: { deltaToken?: string; startdatetime?: string; enddatetime?: string },
): Promise<IMicrosoftCalendarEvents> => {
  try {
    let url = !isEmpty(query.deltaToken) ? query.deltaToken : `${MICROSOFT_ME_API}/calendars/${calendarId}/events?${new URLSearchParams(query)}`;
    if (primaryCalendar) {
      url = !isEmpty(query.deltaToken) ? query.deltaToken : `${MICROSOFT_ME_API}/calendarView/delta?${new URLSearchParams(query)}`;
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: authToken, 'Content-Type': 'application/json', Prefer: 'odata.maxpagesize=30' },
    }).then((res: any) => res.json());
    return response;
  } catch (error) {
    return null;
  }
};

// export const MicrosoftCalendarEvents = async (authToken: string, calendarId: string): Promise<IMicrosoftCalendarEvents> => {

//   try {
//     const response = await fetch(`${MICROSOFT_ME_API}/calendars/${calendarId}/events`, {
//       method: 'GET',
//       headers: { Accept: 'application/json', Authorization: authToken, 'Content-Type': 'application/json' },
//     }).then((res: any) => res.json());
//     return response;
//   } catch (error) {
//     return null;
//   }
// };

export const MicrosoftCreateCalendarEvent = async (data: IMicrosoftCalendarEvent, calendarId: string, authToken: string): Promise<IMicrosoftCalendarEvent> => {
  try {
    const response = await fetch(`${MICROSOFT_ME_API}/calendars/${calendarId}/events`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: authToken, 'Content-Type': 'application/json' },
      redirect: 'follow',
      body: JSON.stringify(data),
    }).then((res: any) => res.json());
    return response;
  } catch (error) {
    return null;
  }
};

export const MicrosoftFetchCalendarEvent = async (resourceUrl: string, authToken: string): Promise<IMicrosoftCalendarEvent> => {
  try {
    const response = await fetch(`${MICROSOFT_BETA_API}/${resourceUrl}`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: authToken, 'Content-Type': 'application/json' },
      redirect: 'follow',
    }).then((res: any) => res.json());
    return response;
  } catch (error) {
    return null;
  }
};

export const MicrosoftPatchCalendarEvent = async (data: IMicrosoftCalendarEvent, calendarId: string, eventId: string, authToken: string): Promise<IMicrosoftCalendarEvent> => {
  try {
    // const url = `${MICROSOFT_ME_API}/calendars/${calendarId}/events/${eventId}`;
    const url = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events/${eventId}`;
    console.log('url ', url);

    const response = await fetch(url, {
      method: 'PATCH',
      headers: { Accept: 'application/json', Authorization: authToken, 'Content-Type': 'application/json' },
      redirect: 'follow',
      body: JSON.stringify(data),
    }).then((res: any) => res.json());
    return response;
  } catch (error) {
    return null;
  }
};

export const MicrosoftDeleteCalendarEvent = async (calendarEventId: string, authToken: string): Promise<IMicrosoftCalendarEvent> => {
  try {
    const response = await fetch(`${MICROSOFT_ME_API}/events/${calendarEventId}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json', Authorization: authToken, 'Content-Type': 'application/json' },
      redirect: 'follow',
    }).then((res: any) => res.json());
    return response;
  } catch (error) {
    return null;
  }
};

export const MicrosoftWatchCalendarEvent = async (
  data: {
    changeType: string;
    notificationUrl: string;
    resource: string;
    expirationDateTime: string;
    // clientState: string
  },
  authToken: string,
): Promise<any> => {
  try {
    const response = await fetch(MICROSOFT_SUBSCRIPTION_API, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: authToken, 'Content-Type': 'application/json' },
      redirect: 'follow',
      body: JSON.stringify(data),
    }).then((res: any) => res.json());
    return response;
  } catch (error) {
    return null;
  }
};

export const MicrosoftStopWatchingCalendarEvent = async (subscriptionId: string, authToken: string): Promise<string> => {
  try {
    await fetch(`${MICROSOFT_SUBSCRIPTION_API}/${subscriptionId}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json', Authorization: authToken, 'Content-Type': 'application/json' },
      redirect: 'follow',
    }).then((res: any) => res.json());
    return 'ok';
  } catch (error) {
    return null;
  }
};
