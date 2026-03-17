import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class FetchDraftTuitionDTO {
  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'Advance English' })
  readonly classes: string;
}

export class CreateDraftTuitionDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'English Pro' })
  readonly name: string;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'Advance English' })
  readonly classes: string;

  @JoiSchema(Joi.any().required())
  @ApiProperty({ example: '75698bc2-aee5-4617-afd2-1d99b127e7ba' })
  readonly data: any;
}
