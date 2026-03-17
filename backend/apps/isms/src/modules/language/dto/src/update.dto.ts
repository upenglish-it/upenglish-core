import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLanguageDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'en' })
  readonly language: string;
}
