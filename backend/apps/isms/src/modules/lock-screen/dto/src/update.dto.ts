import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLockScreenDTO {
  @JoiSchema(Joi.boolean().required())
  @ApiProperty({ example: true })
  readonly enable: boolean;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '1234' })
  readonly code: string;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 60 })
  readonly idleDuration: number;
}
