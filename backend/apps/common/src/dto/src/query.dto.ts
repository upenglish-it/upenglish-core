import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class QueryDTO {
  @JoiSchema(Joi.number().optional())
  @ApiProperty({ example: 10 })
  readonly limit: number;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 10 })
  readonly skip: number;

  @JoiSchema(Joi.number().optional())
  @ApiProperty({ example: 1 })
  readonly active: number;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'John' })
  readonly name: string;

  @JoiSchema(Joi.array().allow(null))
  @ApiProperty({ example: ['51865ef9-e84e-47cd-af41-bc5014cdf936'] })
  readonly branches: Array<string>;

  @JoiSchema(Joi.array().allow(null))
  @ApiProperty({ example: ['51865ef9-e84e-47cd-af41-bc5014cdf936'] })
  readonly staffs: Array<string>;

  @JoiSchema(Joi.array().allow(null))
  @ApiProperty({ example: ['51865ef9-e84e-47cd-af41-bc5014cdf936'] })
  readonly startEndDate: Array<string>;
}
