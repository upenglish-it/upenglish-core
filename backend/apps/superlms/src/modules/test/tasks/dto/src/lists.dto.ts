// NestJs imports
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { JOI_MESSAGES } from 'apps/common';
import { ApiProperty } from '@nestjs/swagger';

export class ListsDTO {
  @JoiSchema(Joi.number().integer().min(1).optional().label('Page').messages(JOI_MESSAGES))
  @ApiProperty({ example: 1 })
  public readonly page: number;

  @JoiSchema(Joi.number().integer().min(1).max(100).optional().label('Limit').messages(JOI_MESSAGES))
  @ApiProperty({ example: 25 })
  public readonly limit: number;
}
