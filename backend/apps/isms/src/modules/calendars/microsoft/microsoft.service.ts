import { HttpStatus, Injectable } from '@nestjs/common';
import {
  IResponseHandlerParams,
  ResponseHandlerService,
  MICROSOFT_OAUTH2_URI,
  IAuthTokenPayload,
  MicrosoftGetToken,
  STATUS_CODE,
  MicrosoftCalendars,
  Calendars,
  CalendarsEvents,
  MicrosoftUserInfo,
  MicrosoftCalendarEvents,
  Integrations,
  MicrosoftGetRefreshToken,
  IEventScheduleRecurrence,
  IGenericNameValue,
  MicrosoftWatchCalendarEvent,
  IMicrosoftCalendarEvent,
  MicrosoftFetchCalendarEvent,
  MicrosoftStopWatchingCalendarEvent,
  Accounts,
  IEventAttendee,
  IEventAttendeeResponse,
  IEventOrganizer,
} from 'apps/common';
import { MicrosoftAuthorizedDTO, MicrosoftCalendarsEventWebhookQueryDTO, MicrosoftSyncAndUnsyncDTO } from './dto';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { isEmpty } from 'lodash';
import { CalendarsService } from '../calendars.service';
import { DateTime } from 'luxon';
import { AnyKeys } from 'mongoose';
import { RRule } from 'rrule';

@Injectable()
export class MicrosoftCalendarService {
  constructor(
    @InjectModel(Integrations) private readonly integrations: ReturnModelType<typeof Integrations>,
    @InjectModel(Calendars) private readonly calendars: ReturnModelType<typeof Calendars>,
    @InjectModel(CalendarsEvents) private readonly calendarsEvents: ReturnModelType<typeof CalendarsEvents>,
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,
    private readonly calendarsService: CalendarsService,
  ) {}

  public async generateRedirectURL(body: any, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const params = {
        client_id: process.env.MICROSOFT_CLIENT_ID,
        response_type: 'code',
        redirect_uri: process.env.CALENDAR_REDIRECT_URL,
        response_mode: 'query',
        scope: process.env.MICROSOFT_SCOPE,
        state: Buffer.from(JSON.stringify({ test: 'data' })).toString('base64'),
        grant_type: 'authorization_code',
      };

      const generateAuthUrl = `${MICROSOFT_OAUTH2_URI}?${new URLSearchParams(params)}`;

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        data: { redirectURI: generateAuthUrl },
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your request to google api. Please try again later',
        errorDetails: error,
      });
    }
  }

  public async preSync(body: MicrosoftAuthorizedDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const getToken = await MicrosoftGetToken({
        code: body.code,
        grant_type: 'authorization_code',
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET_VALUE,
        redirect_uri: process.env.CALENDAR_REDIRECT_URL,
      });

      if (!getToken) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.UNAUTHORIZED,
          message: `Unable to request the access token in microsoft.`,
        });
      }

      const authToken = `${getToken.token_type} ${getToken.access_token}`;

      const userInfo = await MicrosoftUserInfo(authToken);

      if (isEmpty(userInfo)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_ACCEPTABLE,
          statusCode: STATUS_CODE.UNPROCESSABLE_DATA,
          message: 'Unable to sync',
        });
      }

      let integration = await this.integrations.findOne({
        accounts: tokenPayload.accountId,
        company: 'microsoft',
        'data.application': 'calendar',
        $or: [{ 'data.info.mail': userInfo.mail }, { 'data.info.userPrincipalName': userInfo.userPrincipalName }],
      });

      if (isEmpty(integration)) {
        integration = await this.integrations.create({
          company: 'microsoft',
          data: {
            application: 'calendar',
            info: userInfo,
            token: getToken,
            sync: true,
            status: 'synching',
            syncDirection: 'two-way',
          },
          accounts: tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        });
      }

      this.sync({ integrationId: integration._id, sync: true }, tokenPayload).then();

      const integrations = await this.calendarsService.integrated(tokenPayload);
      return integrations;
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async sync(body: MicrosoftSyncAndUnsyncDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const integration = await this.integrations.findOne({ _id: body.integrationId, accounts: tokenPayload.accountId });

      const getRefreshToken = await MicrosoftGetRefreshToken({
        refresh_token: integration.data.token.refresh_token,
        grant_type: 'refresh_token',
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET_VALUE,
      });

      const authToken = `${getRefreshToken.token_type} ${getRefreshToken.access_token}`;

      const createdCalendars = await this.calendars.find({ accounts: tokenPayload.accountId, properties: tokenPayload.propertyId, provider: 'microsoft', integrations: integration._id });

      /* unsync first the the synched calendars */
      await this.unsync({ integrationId: integration._id, sync: false }, tokenPayload);

      const calendars = await MicrosoftCalendars(authToken);

      if (!isEmpty(calendars)) {
        delete calendars['@odata.context'];
      }

      const toSyncCalendar = {
        integrationId: integration._id,
        authToken: authToken,
        calendar: { currentProviderCalendarId: null, currentCalendarId: null, primaryCalendar: false, toBeSync: [] },
        query: { startdatetime: DateTime.now().minus({ year: 10 }).toISODate(), enddatetime: DateTime.now().plus({ year: 10 }).toISODate() },
      };

      for await (const calendar of calendars.value) {
        /* check if calendar is already sync */
        let createdCalendar = createdCalendars.find((c) => c.data.id === calendar.id);
        if (isEmpty(createdCalendar)) {
          createdCalendar = await this.calendars.create({
            data: calendar,
            provider: 'microsoft',
            meta: { insync: false, microsoftWatch: null },
            accounts: tokenPayload.accountId,
            integrations: integration._id,
            properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
          });
        }

        /* sync only the editable calendar */
        if (calendar.canEdit) {
          if (isEmpty(toSyncCalendar.calendar.currentProviderCalendarId) && isEmpty(toSyncCalendar.calendar.currentCalendarId)) {
            toSyncCalendar.calendar.currentProviderCalendarId = calendar.id;
            toSyncCalendar.calendar.currentCalendarId = createdCalendar._id;
            toSyncCalendar.calendar.primaryCalendar = calendar.isDefaultCalendar;
          } else {
            toSyncCalendar.calendar.toBeSync.push({
              providerCalendarId: calendar.id,
              calendarId: createdCalendar._id,
              primaryCalendar: calendar.isDefaultCalendar,
            });
          }

          if (!createdCalendar.meta.insync) {
            /* watch calendar events */
            const watcherExpirationDateTime = DateTime.now().plus({ days: 6 }).toISO();
            MicrosoftWatchCalendarEvent(
              {
                changeType: 'created,updated,deleted',
                notificationUrl: `${process.env.MICROSOFT_CAlENDAR_EVENT_WEBHOOK_URL}?${new URLSearchParams({
                  integrationId: body.integrationId,
                  providerCalendarId: calendar.id,
                  calendarId: createdCalendar._id,
                  accountId: tokenPayload.accountId,
                  propertyId: tokenPayload.queryIds.propertyId,
                  branchId: tokenPayload.queryIds.branchId,
                })}`,
                resource: `/me/calendars/${calendar.id}/events`,
                expirationDateTime: watcherExpirationDateTime,
              },
              authToken,
            ).then((watch) => {
              this.calendars
                .findOneAndUpdate(
                  { _id: createdCalendar._id, accounts: tokenPayload.accountId },
                  {
                    $set: { 'meta.insync': !isEmpty(watch), 'meta.microsoftWatch': watch },
                  },
                )
                .then();
            });
          }
        }
      }

      if (body.sync) {
        this.calendarEventsIncrementalSync(toSyncCalendar, tokenPayload);
      } else {
        this.integrations.updateOne({ _id: body.integrationId, accounts: tokenPayload.accountId }, { 'data.status': 'completed' }).then();
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data. Please try again later',
        errorDetails: error,
      });
    }
  }

  public async unsync(body: MicrosoftSyncAndUnsyncDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const integration = await this.integrations.findOne({ _id: body.integrationId, accounts: tokenPayload.accountId });

      const getRefreshToken = await MicrosoftGetRefreshToken({
        refresh_token: integration.data.token.refresh_token,
        grant_type: 'refresh_token',
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET_VALUE,
      });

      const authToken = `${getRefreshToken.token_type} ${getRefreshToken.access_token}`;

      const createdCalendars = await this.calendars.find({ accounts: tokenPayload.accountId, integrations: body.integrationId, properties: tokenPayload.propertyId });

      // stop the watch for calendar
      for await (const calendar of createdCalendars) {
        if (!isEmpty(calendar.meta.microsoftWatch)) {
          const calendarWatch = await MicrosoftStopWatchingCalendarEvent(calendar.meta.microsoftWatch.id, authToken);
          if (!isEmpty(calendarWatch)) {
            await this.calendars.updateOne({ _id: calendar._id, accounts: tokenPayload.accountId }, { $set: { 'meta.insync': false, 'meta.microsoftWatch': null } });
          }
        }
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.OK,
        message: 'Successfully completed',
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data. Please try again later',
        errorDetails: error,
      });
    }
  }

  private async calendarEventsIncrementalSync(data: ICalendarEventsIncrementalSync, tokenPayload: IAuthTokenPayload): Promise<void> {
    const toBeSync = data.calendar.toBeSync;
    const calendarEvents = await MicrosoftCalendarEvents(data.authToken, data.calendar.currentProviderCalendarId, data.calendar.primaryCalendar, data.query);

    if (calendarEvents?.value) {
      if (!isEmpty(calendarEvents?.value)) {
        const calendarValue = calendarEvents.value.filter((event) => event.type === 'seriesMaster' || event.type === 'singleInstance');
        for (const event of calendarValue) {
          this.manageCalendarEvent(
            {
              event: event,
              integrationId: data.integrationId,
              providerCalendarId: data.calendar.currentProviderCalendarId,
              calendarId: data.calendar.currentCalendarId,
            },
            tokenPayload,
          );
        }
        // after the loop call again the `outlookIncrementalSync` if `deltaToken` is exists
        if (calendarEvents?.['@odata.nextLink']) {
          this.calendarEventsIncrementalSync(
            {
              integrationId: data.integrationId,
              authToken: data.authToken,
              calendar: {
                currentProviderCalendarId: data.calendar.currentProviderCalendarId,
                currentCalendarId: data.calendar.currentCalendarId,
                primaryCalendar: data.calendar.primaryCalendar,
                toBeSync: data.calendar.toBeSync,
              },
              query: { deltaToken: calendarEvents?.['@odata.nextLink'] },
            },
            tokenPayload,
          );
        }
        // else {
        //   if (toBeSync.length > 0) {
        //     const toSync = toBeSync.shift();
        //     this.calendarEventsIncrementalSync(
        //       {
        //         integrationId: data.integrationId,
        //         authToken: data.authToken,
        //         calendar: {
        //           currentProviderCalendarId: toSync.providerCalendarId,
        //           currentCalendarId: toSync.calendarId,
        //           toBeSync: toBeSync,
        //         },
        //         query: { startdatetime: DateTime.now().minus({ year: 5 }).toISODate(), enddatetime: DateTime.now().plus({ year: 1 }).toISODate() },
        //       },
        //       tokenPayload,
        //     );
        //   }

        // }
      } else {
        // if (toBeSync.length > 0) {
        //   const toSync = toBeSync.shift();
        //   this.calendarEventsIncrementalSync(
        //     {
        //       integrationId: data.integrationId,
        //       authToken: data.authToken,
        //       calendar: {
        //         currentProviderCalendarId: toSync.providerCalendarId,
        //         currentCalendarId: toSync.calendarId,
        //         toBeSync: toBeSync,
        //       },
        //       query: { startdatetime: DateTime.now().minus({ year: 5 }).toISODate(), enddatetime: DateTime.now().plus({ year: 1 }).toISODate() },
        //     },
        //     tokenPayload,
        //   );
        // }
      }

      if (toBeSync.length > 0) {
        const toSync = toBeSync.shift();
        this.calendarEventsIncrementalSync(
          {
            integrationId: data.integrationId,
            authToken: data.authToken,
            calendar: {
              currentProviderCalendarId: toSync.providerCalendarId,
              currentCalendarId: toSync.calendarId,
              primaryCalendar: toSync.primaryCalendar,
              toBeSync: toBeSync,
            },
            query: { startdatetime: DateTime.now().minus({ year: 10 }).toISODate(), enddatetime: DateTime.now().plus({ year: 10 }).toISODate() },
          },
          tokenPayload,
        );
      }

      if (toBeSync.length === 0) {
        // synching is completed
        this.integrations.updateOne({ _id: data.integrationId, accounts: tokenPayload.accountId }, { 'data.status': 'completed' }).then();
      }
    }
  }

  public async calendarEventWebhook(body: CalendarEventWebhookBody): Promise<void> {
    const integration = await this.integrations.findOne({ _id: body.integrationId });

    if (!isEmpty(integration)) {
      const getRefreshToken = await MicrosoftGetRefreshToken({
        refresh_token: integration.data.token.refresh_token,
        grant_type: 'refresh_token',
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET_VALUE,
      });

      if (!isEmpty(getRefreshToken)) {
        const authToken = `${getRefreshToken.token_type} ${getRefreshToken.access_token}`;
        for (const value of body.webhook.value) {
          if (value.changeType === 'deleted') {
            this.calendarsEvents.deleteOne({ 'meta.providers.eventId': value.resourceData.id }).then();
          } else {
            MicrosoftFetchCalendarEvent(value.resource, authToken).then((calendarEvent) => {
              this.manageCalendarEvent(
                { event: calendarEvent, integrationId: body.integrationId, providerCalendarId: body.providerCalendarId, calendarId: body.calendarId },
                { accountId: body.accountId, propertyId: body.propertyId, branchId: body.branchId, queryIds: { propertyId: body.propertyId, branchId: body.branchId } },
              );
            });
          }
        }
      }
    }
  }

  private async manageCalendarEvent(data: { event: IMicrosoftCalendarEvent; integrationId: string; providerCalendarId: string; calendarId: string }, tokenPayload: IAuthTokenPayload): Promise<void> {
    const event = data.event;

    if (event.isCancelled) {
      // delete meeting
      this.calendarsEvents
        .deleteOne({ 'calendarIntegration.eventId': event.id, accounts: tokenPayload.accountId as any, properties: tokenPayload.propertyId as any })
        .then()
        .catch();
    } else {
      if (event.type === 'seriesMaster' || event.type === 'singleInstance') {
        this.calendarsEvents.findOne({ 'meta.providers.eventId': event.id, properties: tokenPayload.propertyId }).then(async (calendarEvent) => {
          const fromDateTime = DateTime.fromISO(event.start.dateTime);
          const fromDate = fromDateTime.toISODate();
          const fromTime = fromDateTime.toISOTime({ includeOffset: false });
          const fromTimeZone = event.start.timeZone;

          const toDateTime = DateTime.fromISO(event.end.dateTime);
          const toDate = toDateTime.toISODate();
          const toTime = toDateTime.toISOTime({ includeOffset: false });
          const toTimeZone = event.end.timeZone;

          const isWholeDay = event.isAllDay;
          // fromDateTime.hour === 0 &&
          // fromDateTime.minute === 0 &&
          // fromDateTime.second === 0 &&
          // fromDateTime.millisecond === 0 &&
          // toDateTime.hour === 0 &&
          // toDateTime.minute === 0 &&
          // toDateTime.second === 0 &&
          // toDateTime.millisecond === 0;

          const emailAddresses = [...event.attendees.map((attendee) => attendee.emailAddress.address.toLowerCase()), event.organizer.emailAddress.address.toLowerCase()];
          const accounts = await this.accounts.find({ emailAddresses: { $in: emailAddresses } });

          /* attendees */
          const attendees: Array<IEventAttendee> = event.attendees.map((attendee) => {
            const emailAddress = attendee.emailAddress.address.toLocaleLowerCase();
            const account = accounts.find((acc) => acc.emailAddresses.includes(emailAddress));
            const accountId = !isEmpty(account) ? account._id : null;
            const fullName = !isEmpty(account) ? `${account.firstName} ${account.lastName}` : attendee.emailAddress.name;
            const required = attendee.type === 'required';

            let response: IEventAttendeeResponse = 'none';
            if (attendee.status.response === 'none') {
              response = 'none';
            } else if (attendee.status.response === 'accepted') {
              response = 'accepted';
            } else if (attendee.status.response === 'tentativelyAccepted') {
              response = 'tentative';
            } else if (attendee.status.response === 'declined') {
              response = 'declined';
            }

            const profilePhoto = fullName.split(' ').length >= 2 ? fullName.split(' ')[0] + '' + fullName.split(' ')[1] : fullName.substring(0, 2);

            return {
              accountId: accountId,
              emailAddress: emailAddress,
              name: fullName,
              required: required,
              response: response,
              profilePhoto: profilePhoto.toLowerCase(),
            };
          });

          /* organizer */
          const organizerEmailAddress = event.organizer.emailAddress.address.toLowerCase();
          const organizerAccount = accounts.find((acc) => acc.emailAddresses.includes(organizerEmailAddress));
          const organizer: IEventOrganizer = {
            accountId: !isEmpty(organizerAccount) ? organizerAccount._id : null,
            name: !isEmpty(organizerAccount) ? `${organizerAccount.firstName} ${organizerAccount.lastName}` : event.organizer.emailAddress.name,
            emailAddress: organizerEmailAddress,
          };

          if (!isEmpty(calendarEvent)) {
            // update meeting
            this.calendarsEvents
              .updateOne(
                { _id: calendarEvent.id, properties: tokenPayload.propertyId },
                {
                  $set: {
                    data: event,
                    title: event.subject,
                    description: event.body.content,
                    location: event.location.displayName,
                    attendees: attendees,
                    organizer: organizer,
                    'schedule.fromDate': fromDate,
                    'schedule.fromTime': fromTime,
                    'schedule.fromTimezone': fromTimeZone,

                    'schedule.toDate': toDate,
                    'schedule.toTime': toTime,
                    'schedule.toTimezone': toTimeZone,
                    'schedule.allDay': isWholeDay,
                  },
                },
              )
              .then()
              .catch();
          } else {
            // insert meeting
            const payload: AnyKeys<CalendarsEvents> = {
              title: event.subject,
              description: event.body.content,
              location: event.location.displayName,
              reminder: {
                enable: false,
                prior: 'after',
                span: 'minutes',
                duration: 0,
              },
              schedule: {
                fromDate: fromDate,
                fromTime: fromTime,
                fromTimezone: fromTimeZone,
                toDate: toDate,
                toTime: toTime,
                toTimezone: toTimeZone,
                allDay: isWholeDay,
                recurrence: {
                  enable: false,
                  value: null,
                  freq: null,
                  interval: null,
                  byweekday: [],
                  bymonth: [],
                  ends: {
                    type: 'never',
                    endDate: null,
                    count: null,
                  },
                },
              },
              attendees: attendees,
              organizer: organizer,
              meta: {
                providers: [
                  {
                    calendarId: data.providerCalendarId,
                    eventId: event.id,
                    provider: 'microsoft',
                  },
                ],
                createdFrom: 'microsoft',
              },
              accounts: tokenPayload.accountId as any,
              calendars: data.calendarId,
              integrations: data.integrationId,
              properties: tokenPayload.propertyId as any,
              propertiesBranches: tokenPayload.branchId as any,
              data: event,
            };

            if (event.recurrence) {
              const recurrence: IEventScheduleRecurrence = {
                ...payload.schedule.recurrence,
                enable: true,
                freq: MicrosoftCalendarRecurrencePattern.find((rec) => rec.name === event.recurrence.pattern.type).value,
                ...(event.recurrence.pattern.interval ? { interval: event.recurrence.pattern.interval } : null),
                ...(event.recurrence.pattern.month ? { bymonth: [event.recurrence.pattern.month] } : null),
                ...(event.recurrence.pattern.daysOfWeek
                  ? {
                      byweekday: event.recurrence.pattern.daysOfWeek.map((day) => {
                        const selectedDay = MicrosoftCalendarRecurrenceDaysOfWeek.find((d) => d.name === day).value;
                        return selectedDay;
                      }),
                    }
                  : null),
                ends: {
                  ...payload.schedule.recurrence.ends,
                  type: MicrosoftCalendarRecurrenceRangeType.find((v) => v.name === event.recurrence.range.type).value,
                  endDate: event.recurrence.range?.endDate || null,
                  count: event.recurrence.range?.numberOfOccurrences || null,
                },
              };
              payload.schedule.recurrence = recurrence;
            }

            this.calendarsEvents.create(payload).then().catch();
          }
        });
      }
    }
  }
}

export const MicrosoftCalendarRecurrenceDaysOfWeek: Array<IGenericNameValue> = [
  { name: 'monday', value: RRule.MO.weekday },
  { name: 'tuesday', value: RRule.TU.weekday },
  { name: 'wednesday', value: RRule.WE.weekday },
  { name: 'thursday', value: RRule.TH.weekday },
  { name: 'friday', value: RRule.FR.weekday },
  { name: 'saturday', value: RRule.SA.weekday },
  { name: 'sunday', value: RRule.SU.weekday },
];

export const MicrosoftCalendarRecurrencePattern: Array<IGenericNameValue> = [
  { name: 'relativeYearly', value: RRule.YEARLY },
  { name: 'absoluteYearly', value: RRule.YEARLY },
  { name: 'relativeMonthly', value: RRule.MONTHLY },
  { name: 'absoluteMonthly', value: RRule.MONTHLY },
  { name: 'weekly', value: RRule.WEEKLY },
  { name: 'daily', value: RRule.DAILY },
];

export const MicrosoftCalendarRecurrenceRangeType: Array<IGenericNameValue> = [
  { name: 'noEnd', value: 'never' },
  { name: 'endDate', value: 'on' },
];

interface ICalendarEventsIncrementalSync {
  integrationId: string;
  authToken: string;
  calendar: {
    currentProviderCalendarId: string;
    currentCalendarId: string;
    primaryCalendar: boolean;
    toBeSync: Array<{
      providerCalendarId: string;
      calendarId: string;
      primaryCalendar: boolean;
    }>;
  };
  query: { startdatetime?: string; enddatetime?: string; deltaToken?: string };
}

export interface ICalendarEventWebhook {
  value: Array<{
    subscriptionId: string;
    subscriptionExpirationDateTime: string;
    changeType: 'updated' | 'created' | 'deleted';
    resource: string;
    resourceData: {
      '@odata.type': string;
      '@odata.id': string;
      '@odata.etag': string;
      id: string;
    };
    clientState: string;
    tenantId: string;
  }>;
}

interface CalendarEventWebhookBody extends Partial<MicrosoftCalendarsEventWebhookQueryDTO> {
  webhook: ICalendarEventWebhook;
}
