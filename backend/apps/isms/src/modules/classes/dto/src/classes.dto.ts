import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class FetchClassDTO {
  @JoiSchema(Joi.number().optional())
  @ApiProperty({ example: 10 })
  readonly limit: number;

  @JoiSchema(Joi.number().optional())
  @ApiProperty({ example: 10 })
  readonly skip: number;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'Advance English' })
  readonly name: string;

  @JoiSchema(Joi.boolean().optional())
  @ApiProperty({ example: false })
  readonly showTotalMembers: boolean;
}

export class CreateClassDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'English Pro' })
  readonly name: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '75698bc2-aee5-4617-afd2-1d99b127e7ba' })
  readonly course: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ enum: ['hourly-rate', 'monthly-rate'], example: 'monthly-rate' })
  readonly typeOfRate: string;

  // @JoiSchema(Joi.string().required())
  // @ApiProperty({ example: '75698bc2-aee5-4617-afd2-1d99b127e7ba' })
  // readonly teacherId: string;

  // @JoiSchema(Joi.string().required())
  // @ApiProperty({ example: '75698bc2-aee5-4617-afd2-1d99b127e7ba' })
  // readonly classesDay: string;

  // @JoiSchema(Joi.string().required())
  // @ApiProperty({ example: '75698bc2-aee5-4617-afd2-1d99b127e7ba' })
  // readonly classesTime: string;

  // @JoiSchema(Joi.string())
  // @ApiProperty({ example: '2023-03-20' })
  // readonly startDate: string;

  // @JoiSchema(Joi.string())
  // @ApiProperty({ example: '2023-04-20' })
  // readonly endDate: string;
}

export class UpdateClassDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'English Pro' })
  readonly name: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '75698bc2-aee5-4617-afd2-1d99b127e7ba' })
  readonly course: string;

  // @JoiSchema(Joi.string().required())
  // @ApiProperty({ example: '75698bc2-aee5-4617-afd2-1d99b127e7ba' })
  // readonly teacherId: string;

  // @JoiSchema(Joi.string().required())
  // @ApiProperty({ example: '75698bc2-aee5-4617-afd2-1d99b127e7ba' })
  // readonly classesDay: string;

  // @JoiSchema(Joi.string().required())
  // @ApiProperty({ example: '75698bc2-aee5-4617-afd2-1d99b127e7ba' })
  // readonly classesTime: string;

  // @JoiSchema(Joi.string())
  // @ApiProperty({ example: '2023-03-20' })
  // readonly startDate: string;

  // @JoiSchema(Joi.string())
  // @ApiProperty({ example: '2023-04-20' })
  // readonly endDate: string;
}

export class CreateClassDayDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Weekdays' })
  readonly name: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: [1, 2, 3, 4, 5] })
  readonly days: string;
}

export class UpdateClassDayDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Weekdays' })
  readonly name: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: [1, 2, 3, 4, 5] })
  readonly days: string;
}

export class CreateClassTimeDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Morning Shift' })
  readonly name: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '10:30' })
  readonly from: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '04:30' })
  readonly to: string;
}

export class UpdateClassTimeDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Morning Shift' })
  readonly name: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '10:30' })
  readonly from: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '04:30' })
  readonly to: string;
}
