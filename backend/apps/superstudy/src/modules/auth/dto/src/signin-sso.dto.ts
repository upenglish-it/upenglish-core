import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class AuthSignInSSODTO {
  @JoiSchema(Joi.string().email().required())
  @ApiProperty({ example: 'user@upenglish.vn', description: 'Email resolved from the SSO provider (Google/Microsoft)' })
  readonly emailAddress: string;
}
