import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIncomeDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly studentId: string;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly materialId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 1 })
  readonly amount: number;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 1 })
  readonly quantity: number;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Buy a book' })
  readonly notes: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'cash' })
  readonly mode: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'deposit' })
  readonly from: string;
}
