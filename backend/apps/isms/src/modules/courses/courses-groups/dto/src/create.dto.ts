import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCourseGroupDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'English for adults' })
  readonly name: string;

  @JoiSchema(Joi.array().items(Joi.string().required()).required())
  @ApiProperty({ example: ['ISC5DC7CDE8F394C51A351EF4EFFCC18CD'] })
  readonly courses: Array<string>;
}

export class UpdateCourseGroupDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'English for adults' })
  readonly name: string;

  @JoiSchema(Joi.array().items(Joi.string().required()).required())
  @ApiProperty({ example: ['ISC5DC7CDE8F394C51A351EF4EFFCC18CD'] })
  readonly courses: string;
}
