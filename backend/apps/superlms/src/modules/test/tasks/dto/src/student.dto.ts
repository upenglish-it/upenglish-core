import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { JOI_MESSAGES } from 'apps/common';

export class StudentSubmitTaskDTO {
  @JoiSchema(Joi.string().required().label('Task ID').messages(JOI_MESSAGES))
  @ApiProperty({ example: '' })
  public readonly taskId: string;
}
