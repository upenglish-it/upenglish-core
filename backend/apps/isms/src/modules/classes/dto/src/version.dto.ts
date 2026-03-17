import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class SetVersionClassTuitionPaymentDTO {
  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: '484f2078-cd11-41eb-a6e6-584d39a715c6' })
  readonly versionId: string;
}
