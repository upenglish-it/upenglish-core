import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { JOI_MESSAGES } from 'apps/common';

export class AddSectionDTO {
  @JoiSchema(Joi.string().optional().label('Name').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'Section 1' })
  public readonly name: string;

  @JoiSchema(Joi.string().required().label('Test Of Class Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8' })
  public readonly testOfClassId: string;

  @JoiSchema(Joi.string().required().label('Period Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8' })
  public readonly periodId: string;

  @JoiSchema(Joi.string().required().label('Class Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8' })
  public readonly classId: string;

  @JoiSchema(Joi.string().required().label('Type').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8', enum: ['assignment', 'test'] })
  public readonly type: 'assignment' | 'test';
}

export class UpdateSectionNameDTO {
  @JoiSchema(Joi.string().required().label('Name').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'IELTS' })
  public readonly name: string;
}
