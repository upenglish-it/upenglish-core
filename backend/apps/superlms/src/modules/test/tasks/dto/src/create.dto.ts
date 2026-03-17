import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { JOI_MESSAGES } from 'apps/common';

export class CreateTaskDTO {
  @JoiSchema(Joi.string().required().label('Name').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'IELTS Speaking' })
  public readonly name: string;

  @JoiSchema(Joi.string().required().label('Type').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'reading' })
  public readonly type: 'reading' | 'writing' | 'listening' | 'speaking';
}
