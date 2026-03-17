import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import {} from 'apps/common';

export class CreateBranchDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'University Of Caloocan City' })
  readonly name: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Caloocan City' })
  readonly address: string;
}

export class UpdateBranchDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'University Of Caloocan City' })
  readonly name: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Caloocan City' })
  readonly address: string;
}

export class SwitchBranchDTO {
  @JoiSchema(Joi.string().optional().allow(null))
  @ApiProperty({ example: 'IS488e356ab1774a17a5523b1480c5c60c' })
  readonly branchId: string;
}

export class SetInActiveBranchDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'IS488e356ab1774a17a5523b1480c5c60c' })
  readonly branchId: string;

  @JoiSchema(Joi.boolean().required())
  @ApiProperty({ example: false })
  readonly active: boolean;
}
