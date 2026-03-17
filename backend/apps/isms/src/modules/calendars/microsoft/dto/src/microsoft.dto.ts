import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { IEventAttendee, IEventMeta, IEventReminder, IEventSchedule } from 'apps/common';

export class MicrosoftAuthorizedDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '0.AT4AtJ0fyept9kanLefwF52PywLDqj....' })
  readonly code: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'eyJ0ZXN0IjoiZGF0YSJ9' })
  readonly state: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'bd23ae35-f8c7-487c-a18d-7afc2bbb0035' })
  readonly session_state: string;
}

export class MicrosoftSyncAndUnsyncDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly integrationId: string;

  @JoiSchema(Joi.boolean().required())
  @ApiProperty({ example: false })
  readonly sync: boolean;
}

export class MicrosoftCalendarsEventWebhookQueryDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly integrationId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly providerCalendarId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly calendarId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly accountId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly propertyId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly branchId: string;
}

export class CreateUpdateCalendarsEventDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Staff Planning' })
  readonly title: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Staff meeting about planning' })
  readonly description: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Office meeting' })
  readonly location: string;

  @JoiSchema(Joi.object().required())
  @ApiProperty({
    example: { enable: false, prior: 'after', span: 'minutes', duration: 0 },
  })
  readonly reminder: IEventReminder;

  @JoiSchema(Joi.object().required())
  @ApiProperty({
    example: {
      fromDate: '2023-09-20',
      fromTime: '04:27:31.212',
      fromTimezone: 'Asia/Manila',
      toDate: '2023-09-20',
      toTime: '04:27:31.212',
      toTimezone: 'Asia/Manila',
      allDay: true,
      recurrence: { enable: false, value: 'FREQ=DAILY;COUNT=1', freq: 3, interval: null, byweekday: [], bymonth: [], ends: { type: 'never', endDate: null, count: null } },
    },
  })
  readonly schedule: IEventSchedule;

  @JoiSchema(Joi.array().required())
  @ApiProperty({
    example: [
      {
        accountId: 'UPEFC5D6C31B4D64E88B4E2C2B9CE896813',
        emailAddress: 'jamessmith@yopmail.com',
        name: 'James Smith',
        required: false,
        response: 'none',
        profilePhoto: 'js',
      },
    ],
  })
  readonly attendees: Array<IEventAttendee>;

  @JoiSchema(Joi.object().required())
  @ApiProperty({ example: { createdFrom: 'isms-internally' } })
  readonly meta: IEventMeta;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly integrations: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly calendars: string;
}
