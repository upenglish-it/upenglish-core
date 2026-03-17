import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { JOI_MESSAGES } from 'apps/common';

export class AddTestDTO {
  @JoiSchema(Joi.string().required().label('Test Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8' })
  public readonly testId: string;

  @JoiSchema(Joi.string().required().label('Test Of Class Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8' })
  public readonly testOfClassId: string;

  @JoiSchema(Joi.string().required().label('Period Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8' })
  public readonly periodId: string;

  @JoiSchema(Joi.string().required().label('Course Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8' })
  public readonly classId: string;

  @JoiSchema(Joi.string().required().label('Section Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8' })
  public readonly sectionId: string;
}
