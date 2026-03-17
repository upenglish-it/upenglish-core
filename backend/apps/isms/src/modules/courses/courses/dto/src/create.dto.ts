import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCourseDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Communicative English' })
  readonly name: string;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 1700 })
  readonly price: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 1700 })
  readonly hourlyMonthlyPrice: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 1700 })
  readonly hourlyPackagePrice: number;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: '...' })
  readonly material: string;
}

export class UpdateCourseDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Communicative English' })
  readonly name: string;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 1700 })
  readonly price: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 1700 })
  readonly hourlyMonthlyPrice: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 1700 })
  readonly hourlyPackagePrice: number;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: '...' })
  readonly material: string;
}
