// NestJs imports
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
// Commons
import { IEventSchedule, ISchedulesTime, JOI_MESSAGES, ScheduleTypeC, ScheduleTypeT } from 'apps/common';

export class CreateShiftDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Title' })
  readonly title: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'staff-work' })
  readonly type: string;

  // @JoiSchema(Joi.string().required())
  // @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  // readonly staffId: string;

  @JoiSchema(Joi.array().required())
  @ApiProperty({ example: [{ id: 'IS08076FB87B4B4FD5A252686EE95261D0', schedule: {} }] })
  readonly staffs: Array<{ id: string; schedule: IEventSchedule }>;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly careTakerId: string;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly classId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '' })
  readonly startDate: string;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'Room 1' })
  readonly room: string;

  @JoiSchema(Joi.object().required())
  @ApiProperty({ example: { from: '02:00', to: '03:30' } })
  readonly time: ISchedulesTime;

  // @JoiSchema(Joi.string().required())
  // @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  // readonly scheduleId: string;

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

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly homeworkCheckerId: string;

  @JoiSchema(
    Joi.string()
      .valid(...ScheduleTypeC)
      .required()
      .label('Status')
      .messages(JOI_MESSAGES)
  )
  @ApiProperty({ example: 'ongoing' })
  readonly status: ScheduleTypeT;
}

export class UpdateShiftDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Title' })
  readonly title: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'staff-work' })
  readonly type: string;

  @JoiSchema(Joi.array().required())
  @ApiProperty({ example: [{ id: 'IS08076FB87B4B4FD5A252686EE95261D0', schedule: {} }] })
  readonly staffs: Array<{ id: string; schedule: IEventSchedule }>;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly careTakerId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'ENG 001' })
  readonly classId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '' })
  readonly startDate: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Room 1' })
  readonly room: string;

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

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly homeworkCheckerId: string;

  @JoiSchema(
    Joi.string()
      .valid(...ScheduleTypeC)
      .required()
      .label('Status')
      .messages(JOI_MESSAGES)
  )
  @ApiProperty({ example: 'ongoing' })
  readonly status: ScheduleTypeT;
}

export class ManageTeacherShiftDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly shiftId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly date: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Basic English' })
  readonly notes: string;
}

export class ManageTeacherLessonDetailsDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly shiftId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS08076FB87B4B4FD5A252686EE95261D0' })
  readonly date: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Basic English' })
  readonly lessonDetails: string;
}
