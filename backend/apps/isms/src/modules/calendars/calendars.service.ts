import { HttpStatus, Inject, Injectable, forwardRef } from '@nestjs/common';
import {
  IResponseHandlerParams,
  ResponseHandlerService,
  IAuthTokenPayload,
  STATUS_CODE,
  Integrations,
  CalendarsEvents,
  Calendars,
  MicrosoftCreateCalendarEvent,
  MicrosoftGetRefreshToken,
  IMicrosoftCalendarEvent,
  Accounts,
  TMicrosoftCalendarEventRecurrencePatternDaysOfWeek,
  MicrosoftDeleteCalendarEvent,
  MicrosoftPatchCalendarEvent,
} from 'apps/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { isEmpty } from 'lodash';
import { MicrosoftCalendarRecurrenceDaysOfWeek, MicrosoftCalendarRecurrencePattern, MicrosoftCalendarService } from './microsoft/microsoft.service';
import { CreateUpdateCalendarsEventDTO } from './microsoft/dto';
import { AnyKeys } from 'mongoose';
import { DateTime } from 'luxon';

@Injectable()
export class CalendarsService {
  constructor(
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,
    @InjectModel(Integrations) private readonly integrations: ReturnModelType<typeof Integrations>,
    @InjectModel(CalendarsEvents) private readonly calendarsEvents: ReturnModelType<typeof CalendarsEvents>,
    @InjectModel(Calendars) private readonly calendars: ReturnModelType<typeof Calendars>,
    @Inject(forwardRef(() => MicrosoftCalendarService)) private readonly microsoftCalendarService: MicrosoftCalendarService,
  ) {}

  public async integrated(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const integrations = await this.integrations
        .aggregate([
          {
            $match: {
              accounts: tokenPayload.accountId,
              properties: tokenPayload.propertyId,
              deleted: false,
            },
          },
          {
            $lookup: { from: 'calendars', localField: '_id', foreignField: 'integrations', as: 'calendars' },
          },
          {
            $project: {
              company: 1,
              data: {
                application: 1,
                info: { mail: 1, userPrincipalName: 1 },
                sync: 1,
                status: 1,
                syncDirection: 1,
              },
              calendars: {
                _id: 1,
                meta: {
                  insync: 1,
                },
                data: {
                  id: 1,
                  name: 1,
                  canEdit: 1,
                  isDefaultCalendar: 1,
                },
              },
              createdAt: 1,
            },
          },
        ])
        .sort({ createdAt: -1 });

      if (isEmpty(integrations)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: integrations,
      });
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

  public async fetchIntegratedById(integrationId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const integrations = await this.integrations.aggregate([
        {
          $match: {
            _id: integrationId,
            properties: tokenPayload.propertyId,
            deleted: false,
          },
        },
        {
          $lookup: { from: 'calendars', localField: '_id', foreignField: 'integrations', as: 'calendars' },
        },
        {
          $project: {
            company: 1,
            data: {
              application: 1,
              info: { mail: 1, userPrincipalName: 1 },
              sync: 1,
              status: 1,
              syncDirection: 1,
            },
            calendars: {
              _id: 1,
              meta: {
                insync: 1,
              },
              data: {
                id: 1,
                name: 1,
                canEdit: 1,
                isDefaultCalendar: 1,
              },
            },
          },
        },
      ]);

      if (isEmpty(integrations)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: integrations[0],
      });
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

  public async unlink(integrationId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.microsoftCalendarService.unsync({ integrationId: integrationId, sync: false }, tokenPayload);
      this.integrations.deleteOne({ _id: integrationId, properties: tokenPayload.propertyId }).then();
      this.calendars.deleteMany({ integrations: integrationId, properties: tokenPayload.propertyId }).then();
      this.calendarsEvents.deleteMany({ integrations: integrationId, properties: tokenPayload.propertyId }).then();
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: 'Successfully unlink',
      });
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

  public async calendarEvents(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const calendarsEvents = await this.calendarsEvents
        .aggregate([
          {
            $match: { accounts: tokenPayload.accountId, deleted: false },
          },
          {
            $lookup: { from: 'calendars', foreignField: '_id', localField: 'calendars', as: 'calendars' },
          },
          { $unwind: '$calendars' },
          {
            $project: {
              data: 0,
              calendars: {
                data: {
                  id: 0,
                  name: 0,
                  color: 0,
                  isDefaultCalendar: 0,
                  changeKey: 0,
                  canShare: 0,
                  canViewPrivateItems: 0,
                  isShared: 0,
                  isSharedWithMe: 0,
                  canEdit: 0,
                  calendarGroupId: 0,
                  allowedOnlineMeetingProviders: 0,
                  defaultOnlineMeetingProvider: 0,
                  isTallyingResponses: 0,
                  isRemovable: 0,
                  owner: 0,
                },
                // _id: 0,
                accounts: 0,
                integrations: 0,
                properties: 0,
                propertiesBranches: 0,
                deleted: 0,
                createdAt: 0,
              },
              // data: {
              //   application: 1,
              //   info: { mail: 1, userPrincipalName: 1 },
              //   sync: 1,
              //   status: 1,
              //   syncDirection: 1,
              // },
              // calendars: {
              //   _id: 1,
              //   data: {
              //     id: 1,
              //     name: 1,
              //     canEdit: 1,
              //     isDefaultCalendar: 1,
              //   },
              // },
            },
          },
        ])
        .sort({ createdAt: -1 });

      if (isEmpty(calendarsEvents)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: calendarsEvents,
      });
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

  public async createCalendarEvent(body: CreateUpdateCalendarsEventDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const calendar = await this.calendars.findOne({
        _id: body.calendars,
        accounts: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
      });

      const integration = await this.integrations.findOne({
        _id: calendar.integrations,
        accounts: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
      });

      if (isEmpty(integration) || isEmpty(calendar)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      const organizer = await this.accounts.findOne({ _id: tokenPayload.accountId });

      let createdCalendarsEvent: CalendarsEvents = null;

      if (integration.company === 'microsoft') {
        const getRefreshToken = await MicrosoftGetRefreshToken({
          refresh_token: integration.data.token.refresh_token,
          grant_type: 'refresh_token',
          client_id: process.env.MICROSOFT_CLIENT_ID,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET_VALUE,
        });
        const authToken = `${getRefreshToken.token_type} ${getRefreshToken.access_token}`;

        const attendees = body.attendees.map((attendee) => {
          return {
            emailAddress: {
              address: attendee.emailAddress,
              name: attendee.name,
            },
            type: attendee.required ? 'required' : 'optional',
          };
        });

        const startDateTime = body.schedule.allDay ? body.schedule.fromDate : body.schedule.fromDateTime;

        const microsoftPayload: IMicrosoftCalendarEvent = {
          reminderMinutesBeforeStart: 10,
          isReminderOn: true,
          subject: body.title,
          // bodyPreview: string;
          // importance: string;
          // sensitivity: string;
          // onlineMeetingUrl: any;
          // isOnlineMeeting: boolean;
          // onlineMeetingProvider: string;
          // allowNewTimeProposals: boolean;
          // occurrenceId: any;
          // isDraft: boolean;
          // hideAttendees: boolean;
          // responseStatus: {
          //   response: string;
          //   time: string;
          // };
          body: {
            contentType: 'html',
            content: body.description,
          },
          isAllDay: body.schedule.allDay,
          start: {
            dateTime: startDateTime,
            timeZone: body.schedule.fromTimezone,
          },
          end: {
            dateTime: body.schedule.allDay ? body.schedule.toDate : body.schedule.toDateTime,
            timeZone: body.schedule.toTimezone,
          },
          location: {
            displayName: body.location,
            // locationType: 'default';
            // uniqueId: string;
            // uniqueIdType: 'private';
            // address: body.location,
            // coordinates: any;
          },
          attendees: attendees,
          organizer: {
            emailAddress: {
              name: `${organizer.firstName} ${organizer.lastName}`.trim(),
              address: organizer.emailAddresses[0],
            },
          },
          // onlineMeeting: any;
        } as any;

        if (body.schedule.recurrence.freq !== null) {
          microsoftPayload['recurrence'] = {
            pattern: {
              type: MicrosoftCalendarRecurrencePattern.find((rec) => rec.value === body.schedule.recurrence.freq).name as any,
              ...(body.schedule.recurrence.interval ? { interval: body.schedule.recurrence.interval } : null),
              ...(body.schedule.recurrence.bymonth ? { month: body.schedule.recurrence.bymonth[0] } : null),
              ...(body.schedule.recurrence.byweekday
                ? {
                    daysOfWeek: body.schedule.recurrence.byweekday.map((day) => {
                      const selectedDay = MicrosoftCalendarRecurrenceDaysOfWeek.find((d) => d.value === day).name;
                      return selectedDay as TMicrosoftCalendarEventRecurrencePatternDaysOfWeek;
                    }),
                  }
                : null),
              // dayOfMonth: number;
              // firstDayOfWeek: 'sunday';
              // index: 'first';
            },
            range: {
              ...(body.schedule.recurrence.ends.type === 'never' ? { type: 'noEnd' } : null),
              ...(body.schedule.recurrence.ends.type === 'on' ? { type: 'endDate' } : null),
              ...(body.schedule.recurrence.ends.type === 'after' ? { type: 'endDate' } : null),
              ...(body.schedule.recurrence.ends.count !== null ? { numberOfOccurrences: body.schedule.recurrence.ends.count } : null),
              ...(body.schedule.recurrence.ends.endDate !== null ? { endDate: body.schedule.recurrence.ends.endDate } : null),
              ...(body.schedule.recurrence.ends.type === 'never' && body.schedule.recurrence.ends.endDate === null
                ? { startDate: DateTime.fromISO(startDateTime).plus({ days: 1 }).toISODate(), endDate: '0001-01-01' }
                : null),

              // startDate: string;
              // recurrenceTimeZone: string;
            },
          };
        }

        const microsoftCreateCalendarEvent = await MicrosoftCreateCalendarEvent(microsoftPayload, calendar.data.id, authToken);

        if (microsoftCreateCalendarEvent.id) {
          const payload: AnyKeys<CalendarsEvents> = {
            title: body.title,
            description: body.description,
            location: body.location,
            reminder: {
              enable: false,
              prior: 'after',
              span: 'minutes',
              duration: 0,
            },
            schedule: body.schedule,
            attendees: body.attendees,
            organizer: {
              accountId: organizer._id,
              name: `${organizer.firstName} ${organizer.lastName}`.trim(),
              emailAddress: organizer.emailAddresses[0],
            },
            meta: {
              providers: [
                {
                  provider: 'microsoft',
                  calendarId: calendar.data.id,
                  eventId: microsoftCreateCalendarEvent.id,
                },
              ],
              createdFrom: 'isms-internally',
            },
            accounts: tokenPayload.accountId as any,
            calendars: calendar._id,
            integrations: integration._id,
            properties: tokenPayload.propertyId as any,
            propertiesBranches: tokenPayload.branchId as any,
            data: microsoftCreateCalendarEvent,
          };
          createdCalendarsEvent = await this.calendarsEvents.create(payload);
        }
      }

      const calendarEvent = await this.fetchCalendarEventById(createdCalendarsEvent._id, tokenPayload);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        message: 'Successfully created',
        data: calendarEvent,
      });
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

  public async updateCalendarEvent(calendarEventId: string, body: CreateUpdateCalendarsEventDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const calendarsEvent = await this.calendarsEvents.findOne({
        _id: calendarEventId,
        accounts: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
      });

      const calendar = await this.calendars.findOne({
        _id: calendarsEvent.calendars,
        accounts: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
      });

      const integration = await this.integrations.findOne({
        _id: calendar.integrations,
        accounts: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
      });

      if (isEmpty(calendarsEvent) || isEmpty(integration) || isEmpty(calendar)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      const provider = calendarsEvent.meta.providers.find((p) => p.calendarId === calendar.data.id && p.provider === 'microsoft');

      if (provider.provider === 'microsoft') {
        const getRefreshToken = await MicrosoftGetRefreshToken({
          refresh_token: integration.data.token.refresh_token,
          grant_type: 'refresh_token',
          client_id: process.env.MICROSOFT_CLIENT_ID,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET_VALUE,
        });
        const authToken = `${getRefreshToken.token_type} ${getRefreshToken.access_token}`;

        const attendees = body.attendees.map((attendee) => {
          return {
            emailAddress: {
              address: attendee.emailAddress,
              name: attendee.name,
            },
            type: attendee.required ? 'required' : 'optional',
          };
        });

        const startDateTime = body.schedule.allDay ? body.schedule.fromDate : body.schedule.fromDateTime;

        const microsoftPayload: IMicrosoftCalendarEvent = {
          subject: body.title,
          body: {
            contentType: 'html',
            content: body.description,
          },
          isAllDay: body.schedule.allDay,
          start: {
            dateTime: startDateTime,
            timeZone: body.schedule.fromTimezone,
          },
          end: {
            dateTime: body.schedule.allDay ? body.schedule.toDate : body.schedule.toDateTime,
            timeZone: body.schedule.toTimezone,
          },
          location: {
            displayName: body.location,
            // locationType: 'default';
            // uniqueId: string;
            // uniqueIdType: 'private';
            // address: body.location,
            // coordinates: any;
          },
          attendees: attendees,
          // onlineMeeting: any;
        } as any;

        if (body.schedule.recurrence.freq !== null) {
          microsoftPayload['recurrence'] = {
            pattern: {
              type: MicrosoftCalendarRecurrencePattern.find((rec) => rec.value === body.schedule.recurrence.freq).name as any,
              ...(body.schedule.recurrence.interval ? { interval: body.schedule.recurrence.interval } : null),
              ...(body.schedule.recurrence.bymonth ? { month: body.schedule.recurrence.bymonth[0] } : null),
              ...(body.schedule.recurrence.byweekday
                ? {
                    daysOfWeek: body.schedule.recurrence.byweekday.map((day) => {
                      const selectedDay = MicrosoftCalendarRecurrenceDaysOfWeek.find((d) => d.value === day).name;
                      return selectedDay as TMicrosoftCalendarEventRecurrencePatternDaysOfWeek;
                    }),
                  }
                : null),
              // dayOfMonth: number;
              // firstDayOfWeek: 'sunday';
              // index: 'first';
            },
            range: {
              ...(body.schedule.recurrence.ends.type === 'never' ? { type: 'noEnd' } : null),
              ...(body.schedule.recurrence.ends.type === 'on' ? { type: 'endDate' } : null),
              ...(body.schedule.recurrence.ends.type === 'after' ? { type: 'endDate' } : null),
              ...(body.schedule.recurrence.ends.count !== null ? { numberOfOccurrences: body.schedule.recurrence.ends.count } : null),
              ...(body.schedule.recurrence.ends.endDate !== null ? { endDate: body.schedule.recurrence.ends.endDate } : null),
              ...(body.schedule.recurrence.ends.type === 'never' && body.schedule.recurrence.ends.endDate === null
                ? { startDate: DateTime.fromISO(startDateTime).plus({ days: 1 }).toISODate(), endDate: '0001-01-01' }
                : null),

              // startDate: string;
              // recurrenceTimeZone: string;
            },
          };
        }

        MicrosoftPatchCalendarEvent(microsoftPayload, calendar.data.id, provider.eventId, authToken);
      }

      await this.calendarsEvents.updateOne(
        { _id: calendarEventId },
        {
          $set: {
            title: body.title,
            description: body.description,
            location: body.location,
            schedule: body.schedule,
            attendees: body.attendees,
          },
        },
      );

      const calendarEvent = await this.fetchCalendarEventById(calendarEventId, tokenPayload);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        message: 'Successfully updated',
        data: calendarEvent,
      });
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

  public async deleteCalendarEvent(calendarEventId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const calendarsEvent = await this.calendarsEvents.findOne({
        _id: calendarEventId,
        accounts: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
      });

      const calendar = await this.calendars.findOne({
        _id: calendarsEvent.calendars,
        accounts: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
      });

      const integration = await this.integrations.findOne({
        _id: calendar.integrations,
        accounts: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
      });

      if (isEmpty(calendarsEvent) || isEmpty(integration) || isEmpty(calendar)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      if (integration.company === 'microsoft') {
        const getRefreshToken = await MicrosoftGetRefreshToken({
          refresh_token: integration.data.token.refresh_token,
          grant_type: 'refresh_token',
          client_id: process.env.MICROSOFT_CLIENT_ID,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET_VALUE,
        });
        const authToken = `${getRefreshToken.token_type} ${getRefreshToken.access_token}`;

        const provider = calendarsEvent.meta.providers.find((p) => p.calendarId === calendar.data.id && p.provider === 'microsoft');

        MicrosoftDeleteCalendarEvent(provider.eventId, authToken);
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        message: 'Successfully deleted',
      });
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

  public async fetchCalendarEventById(calendarEventId: string, tokenPayload: IAuthTokenPayload): Promise<CalendarsEvents> {
    const calendarsEvent = await this.calendarsEvents.aggregate([
      {
        $match: { _id: calendarEventId, accounts: tokenPayload.accountId, deleted: false },
      },
      {
        $lookup: { from: 'calendars', foreignField: '_id', localField: 'calendars', as: 'calendars' },
      },
      { $unwind: '$calendars' },
      {
        $project: {
          data: 0,
          calendars: {
            data: {
              id: 0,
              name: 0,
              color: 0,
              isDefaultCalendar: 0,
              changeKey: 0,
              canShare: 0,
              canViewPrivateItems: 0,
              isShared: 0,
              isSharedWithMe: 0,
              canEdit: 0,
              calendarGroupId: 0,
              allowedOnlineMeetingProviders: 0,
              defaultOnlineMeetingProvider: 0,
              isTallyingResponses: 0,
              isRemovable: 0,
              owner: 0,
            },
            accounts: 0,
            integrations: 0,
            properties: 0,
            propertiesBranches: 0,
            deleted: 0,
            createdAt: 0,
          },
        },
      },
    ]);
    return calendarsEvent[0];
  }
}
