import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { IPermission, RoleAndPermission } from 'apps/common';

export class CreateRolePermissionDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Assistant Professor' })
  readonly name: string;

  @JoiSchema(Joi.array().required())
  @ApiProperty({
    example: RoleAndPermission('admin'),
  })
  readonly permissions: Array<IPermission>;
}
