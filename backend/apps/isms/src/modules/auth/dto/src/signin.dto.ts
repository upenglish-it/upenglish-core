import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class AuthSignInDTO {
  @JoiSchema(Joi.string().email().required())
  @ApiProperty({ example: 'microsoft' })
  readonly provider: 'microsoft' | 'google' | 'email-password';

  @JoiSchema(Joi.string().email().optional())
  @ApiProperty({ example: 'masteracc@yopmail.com' })
  readonly emailAddress: string;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: '1234567890' })
  readonly password: string;
}
