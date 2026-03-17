import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { JOI_MESSAGES } from 'apps/common';

export class AddPeriodDTO {
  @JoiSchema(Joi.string().optional().label('Name').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'Period 1' })
  public readonly name: string;

  @JoiSchema(Joi.string().required().label('Course Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8' })
  public readonly classId: string;
}

export class UpdatePeriodNameDTO {
  @JoiSchema(Joi.string().required().label('Name').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'IELTS' })
  public readonly name: string;
}
