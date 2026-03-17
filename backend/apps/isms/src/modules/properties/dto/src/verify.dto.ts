import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyRegisteredEmailAddressAccountDTO {
  @JoiSchema(Joi.string().email().required())
  @ApiProperty({ example: 'ABC123' })
  readonly code: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({
    example: 'egvlHmIQHOup1smwbAOo/YuIeIcexBdwul...',
  })
  readonly verificationToken: string;
}
