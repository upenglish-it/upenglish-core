// Joi
import * as Joi from 'joi';
// Nestjs imports
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
// Commons
import { JOI_MESSAGES, TStudentsTuitionAttendanceReason } from 'apps/common';

export class EnrollStudentToClassDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly classId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly studentClassId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly studentId: string;

  @JoiSchema(
    Joi.array()
      .items(
        Joi.object({
          included: Joi.number().required(),
          enable: Joi.number().required(),
          day: Joi.number().required(),
          month: Joi.number().required(),
          year: Joi.number().required(),
        })
      )
      .required()
  )
  @ApiProperty({
    example: [{ included: true, enable: true, day: 15, month: 8, year: 2023, paymentType: 'monthly' }],
  })
  // readonly dates: Array<{ paymentHistoryId?: string; amount: number; day: number; month: number; year: number; paymentType: 'monthly' | 'package' }>;
  readonly dates: Array<IClassPricingDate>;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 0 })
  readonly discount: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 0 })
  readonly addition: number;

  @JoiSchema(Joi.boolean().required())
  @ApiProperty({ example: false })
  readonly cantPayThisMonth: boolean;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 0 })
  readonly subtraction: number;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'Some notes' })
  readonly notes: string;

  @JoiSchema(Joi.boolean().required())
  @ApiProperty({ example: false })
  readonly newEnroll: boolean;

  @JoiSchema(Joi.boolean().required())
  @ApiProperty({ example: false })
  readonly payDebt: boolean;
}

export class StopLearningDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly classId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly studentId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '2024-06-06' })
  readonly stoppedDate: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'request' })
  readonly action: 'request' | 'confirmed';

  @JoiSchema(Joi.string().required())
  @ApiProperty({ enumName: 'asdasd', enum: ['cant-pay', 'leave-without-notice'] })
  readonly reason: TStudentsTuitionAttendanceReason;
}

export class StopLearningAccumulatedDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly classId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly studentId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'request' })
  readonly action: 'request' | 'confirmed';

  @JoiSchema(Joi.string().required())
  @ApiProperty({ enumName: 'asdasd', enum: ['cant-pay', 'leave-without-notice'] })
  readonly reason: TStudentsTuitionAttendanceReason;
}

export class ClassPricingDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly classId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly studentId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly studentClassId: string;

  @JoiSchema(
    Joi.array()
      .items(
        Joi.object({
          included: Joi.number().required(),
          enable: Joi.number().required(),
          day: Joi.number().required(),
          month: Joi.number().required(),
          year: Joi.number().required(),
        })
      )
      .required()
  )
  @ApiProperty({
    example: [{ included: true, enable: true, day: 15, month: 8, year: 2023, paymentType: 'monthly' }],
  })
  readonly dates: Array<IClassPricingDate>;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 0 })
  readonly discount: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 0 })
  readonly addition: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 0 })
  readonly subtraction: number;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'Some notes' })
  readonly notes: string;

  // @JoiSchema(Joi.string().required())
  // @ApiProperty({ enumName: 'asdasd', enum: ['monthly', 'package'] })
  // readonly paymentType: 'monthly' | 'package';

  @JoiSchema(Joi.boolean().required())
  @ApiProperty({ example: false })
  readonly cantPayThisMonth: boolean;

  @JoiSchema(Joi.boolean().required())
  @ApiProperty({ example: false })
  readonly payDebt: boolean;

  @JoiSchema(Joi.boolean().required())
  @ApiProperty({ example: false })
  readonly newEnroll: boolean;
}

export class RefundClassDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly studentId: string;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 1000 })
  readonly amount: number;
}

export class MarkAttendanceDTO {
  @JoiSchema(Joi.object({ day: Joi.number().required(), month: Joi.number().required(), year: Joi.number().required() }))
  @ApiProperty({
    example: [
      {
        studentId: 'UPE01K101DSKAAJZ0AHNPQYE8543Q',
        studentClassId: 'UPE01K575VZPAZBZK1BEDR86FW4DQ',
        studentTuitionAttendanceId: 'UPE01K5769DPZS1HPKEX3498NPFVP',
        day: 15,
        month: 9,
        year: 2025,
        hour: 22,
        minute: 42,
        notes: 'ad',
        status: 'off-day',
      },
    ],
  })
  readonly records: Array<{
    studentId: string;
    // studentClassId: string;
    studentTuitionAttendanceId: string;
    day: number;
    month: number;
    year: number;
    hour: string;
    minute: string;
    notes: string;
    status: 'unmark' | 'present' | 'off-day' | 'absent-with-notice' | 'absent';
  }>;
}

export class TuitionStudentsInClassDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly classId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '06-2023' })
  readonly date: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '1000' })
  readonly amount: string;

  @JoiSchema(Joi.number().integer().min(1).optional().label('Page').messages(JOI_MESSAGES))
  @ApiProperty({ example: 1 })
  public readonly page: number;

  @JoiSchema(Joi.number().integer().min(1).max(100).optional().label('Limit').messages(JOI_MESSAGES))
  @ApiProperty({ example: 25 })
  public readonly limit: number;
}

export class AttendanceStudentsInClassDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly classId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '06-2023' })
  readonly date: string;

  @JoiSchema(Joi.boolean().optional())
  @ApiProperty({ example: false })
  readonly assignedToTeacher: boolean;

  @JoiSchema(Joi.number().integer().min(1).optional().label('Page').messages(JOI_MESSAGES))
  @ApiProperty({ example: 1 })
  public readonly page: number;

  @JoiSchema(Joi.number().integer().min(1).max(100).optional().label('Limit').messages(JOI_MESSAGES))
  @ApiProperty({ example: 25 })
  public readonly limit: number;
}

export class BreakdownOfClassDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly studentId: string;
}

export class StudentClassDebtsDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly studentId: string;
}

export interface IClassPricingDate {
  paymentHistoryId?: string;
  amount: number;
  day: number;
  month: number;
  year: number;
  paymentType: 'monthly' | 'package';
  included: boolean;
  enable: boolean;
  remainingInMonth: boolean;
}
