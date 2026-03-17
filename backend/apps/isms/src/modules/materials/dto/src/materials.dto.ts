import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMaterialDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Rich Dad Poor Dad' })
  readonly name: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 500 })
  readonly price: number;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 10 })
  readonly quantity: number;
}

export class UpdateMaterialDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Rich Dad Poor Dad' })
  readonly name: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 500 })
  readonly price: number;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 10 })
  readonly quantity: number;
}
