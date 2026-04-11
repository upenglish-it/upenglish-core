import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class AuthSignInSSODTO {
  @JoiSchema(Joi.string().email().required())
  @ApiProperty({ example: 'user@upenglish.vn', description: 'Email resolved from the SSO provider (Google/Microsoft)' })
  readonly emailAddress: string;

  @JoiSchema(Joi.string().optional().allow('', null))
  @ApiProperty({ example: 'firebase-provider-uid', required: false })
  readonly uid?: string;

  @JoiSchema(Joi.string().optional().allow('', null))
  @ApiProperty({ example: 'Jane Doe', required: false })
  readonly displayName?: string;

  @JoiSchema(Joi.string().optional().allow('', null))
  @ApiProperty({ example: 'https://example.com/photo.png', required: false })
  readonly photoURL?: string;
}
