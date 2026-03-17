import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { IEventSchedule, ISchedulesTime } from 'apps/common';

export class CreateScheduleDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Morning Shift' })
  readonly title: string;

  @JoiSchema(Joi.object().required())
  @ApiProperty({ example: { from: '02:00', to: '03:30' } })
  readonly time: ISchedulesTime;

  @JoiSchema(Joi.object().required())
  @ApiProperty({
    example: {
      fromDate: '2023-09-07',
      fromTime: '17:30',
      fromTimezone: 'Asia/Manila',
      toDate: '2024-09-07',
      toTime: '17:30',
      toTimezone: 'Asia/Manila',
      allDay: true,
      recurrence: {
        enable: null,
        value: 'custom',
        freq: 2,
        interval: 1,
        byweekday: [0, 2, 4],
        bymonth: null,
        ends: {
          type: 'never',
          endDate: null,
          count: null,
        },
      },
    },
  })
  readonly schedule: IEventSchedule;
}

export class UpdateScheduleDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Morning Shift' })
  readonly title: string;

  @JoiSchema(Joi.object().required())
  @ApiProperty({ example: { from: '02:00', to: '03:30' } })
  readonly time: ISchedulesTime;

  @JoiSchema(Joi.object().required())
  @ApiProperty({
    example: {
      fromDate: '2023-09-07',
      fromTime: '17:30',
      fromTimezone: 'Asia/Manila',
      toDate: '2024-09-07',
      toTime: '17:30',
      toTimezone: 'Asia/Manila',
      allDay: true,
      recurrence: {
        enable: null,
        value: 'custom',
        freq: 2,
        interval: 1,
        byweekday: [0, 2, 4],
        bymonth: null,
        ends: {
          type: 'never',
          endDate: null,
          count: null,
        },
      },
    },
  })
  readonly schedule: IEventSchedule;
}
