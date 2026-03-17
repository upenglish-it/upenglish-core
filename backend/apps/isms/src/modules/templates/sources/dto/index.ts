import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSourceDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'facebook' })
  readonly value: string;
}

export class UpdateSourceDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'facebook' })
  readonly value: string;
}
