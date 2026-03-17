import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { JOI_MESSAGES } from 'apps/common';

export class AddNotesInTimelineDTO {
  @JoiSchema(Joi.string().required().label('Notes').messages(JOI_MESSAGES))
  @ApiProperty({ example: '' })
  public readonly notes: string;

  @JoiSchema(Joi.string().required().label('Class ID').messages(JOI_MESSAGES))
  @ApiProperty({ example: '' })
  public readonly classId: string;
}
