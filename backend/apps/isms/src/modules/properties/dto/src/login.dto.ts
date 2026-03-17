import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class LoginAccountDTO {
  @JoiSchema(Joi.string().email().required())
  @ApiProperty({ example: 'johndoe@yopmail.com' })
  readonly emailAddress: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '1234567890' })
  readonly password: string;
}
