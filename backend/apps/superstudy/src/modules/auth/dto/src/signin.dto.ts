import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class AuthSignInDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'email-password', enum: ['email-password', 'microsoft', 'google'] })
  readonly provider: 'email-password' | 'microsoft' | 'google';

  @JoiSchema(Joi.string().email().optional())
  @ApiProperty({ example: 'user@example.com' })
  readonly emailAddress: string;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'password123' })
  readonly password: string;
}
