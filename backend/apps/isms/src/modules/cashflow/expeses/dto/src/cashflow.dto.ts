import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class CreateExpenseDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Buy a book' })
  readonly notes: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 500 })
  readonly amount: number;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'cash' })
  readonly mode: string;
}
