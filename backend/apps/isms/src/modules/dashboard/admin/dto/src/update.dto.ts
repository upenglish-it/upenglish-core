import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNotificationDTO {
  @JoiSchema(Joi.boolean().required())
  @ApiProperty({ example: true })
  readonly softwareUpdates: boolean;

  @JoiSchema(Joi.boolean().required())
  @ApiProperty({ example: true })
  readonly announcement: boolean;

  @JoiSchema(Joi.boolean().required())
  @ApiProperty({ example: true })
  readonly tuitionPaymentInvoice: boolean;

  @JoiSchema(Joi.boolean().required())
  @ApiProperty({ example: true })
  readonly challenges: boolean;
}

export class UpdateGCMDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '...' })
  readonly token: string;
}
