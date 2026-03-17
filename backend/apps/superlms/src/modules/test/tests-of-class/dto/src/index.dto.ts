import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { JOI_MESSAGES } from 'apps/common';

export class UpdateStatusDTO {
  @JoiSchema(Joi.string().required().label('Course Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8' })
  public readonly classId: string;

  @JoiSchema(Joi.string().required().label('Status').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'IELTS' })
  public readonly status: 'draft' | 'published';
}

export class UpdateDescriptionDTO {
  @JoiSchema(Joi.string().required().label('Course Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8' })
  public readonly classId: string;

  @JoiSchema(Joi.string().required().label('Description').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'This is a sample description' })
  public readonly description: string;
}
