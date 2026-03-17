import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import {} from 'apps/common';

export class CreatePropertyDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'University Of Caloocan City' })
  readonly propertyName: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '12345' })
  readonly planId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: [{ moduleId: '12345' }] })
  readonly customPlan: Array<{ moduleId: string }>;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Juan' })
  readonly firstName: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Dela Cruz' })
  readonly lastName: string;

  @JoiSchema(Joi.string().email().required())
  @ApiProperty({ example: 'jdc@yopmail.com' })
  readonly emailAddress: string;
}
