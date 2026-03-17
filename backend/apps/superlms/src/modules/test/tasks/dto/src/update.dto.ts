import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { JOI_MESSAGES } from 'apps/common';

export class UpdateByIdTaskDTO {
  @JoiSchema(Joi.string().required().label('Course').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'IELTS' })
  public readonly name: string;

  @JoiSchema(Joi.number().required().label('Duration').messages(JOI_MESSAGES))
  @ApiProperty({ example: 1000 })
  public readonly duration: number;

  @JoiSchema(Joi.number().required().label('Selected Variation Index').messages(JOI_MESSAGES))
  @ApiProperty({ example: 1 })
  public readonly selectedVariationIndex: number;

  @JoiSchema(Joi.number().required().label('Selected Part Index').messages(JOI_MESSAGES))
  @ApiProperty({ example: 1 })
  public readonly selectedPartIndex: number;

  @JoiSchema(Joi.string().required().label('Type').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'reading' })
  public readonly type: 'reading' | 'writing' | 'listening' | 'speaking';

  @JoiSchema(Joi.array().required().label('Variations').messages(JOI_MESSAGES))
  @ApiProperty({ example: [] })
  public readonly variations: any[];
}
