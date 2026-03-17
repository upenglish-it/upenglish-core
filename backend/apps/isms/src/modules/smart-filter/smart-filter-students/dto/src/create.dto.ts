import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSmartFilterDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Newly Enrolled' })
  readonly title: string;

  @JoiSchema(Joi.array().required())
  @ApiProperty({ example: [] })
  readonly filters: Array<any>;
}

export class UpdateSmartFilterDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Newly Enrolled' })
  readonly title: string;

  @JoiSchema(Joi.array().required())
  @ApiProperty({ example: [] })
  readonly filters: Array<any>;
}
