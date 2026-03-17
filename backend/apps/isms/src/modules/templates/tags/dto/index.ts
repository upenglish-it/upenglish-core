import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class GetTagsDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'general' })
  readonly type: 'general' | 'pipeline' | 'relationship';
}

export class CreateTagDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'English Pro' })
  readonly value: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '#000000' })
  readonly color: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'general' })
  readonly type: 'general' | 'relationship';
}

export class UpdateTagDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'English Pro' })
  readonly value: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '#000000' })
  readonly color: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'general' })
  readonly type: 'general' | 'relationship';
}
