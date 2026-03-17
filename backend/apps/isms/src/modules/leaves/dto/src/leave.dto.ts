import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { ILeavesDate, TLeavesStatus, TLeavesType } from 'apps/common';

export class RequestLeaveDTO {
  @JoiSchema(Joi.array().items({ from: Joi.string().required(), to: Joi.string().required() }).required())
  @ApiProperty({ example: [{ date: '2023-09-15' }] })
  readonly dates: Array<ILeavesDate>;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'I need vacation leave' })
  readonly notes: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'pto' })
  readonly type: TLeavesType;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 1 })
  readonly hours: number;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: false })
  readonly payable: 'paid' | 'unpaid';
}

export class ActionLeaveRequestDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '75698bc2-aee5-4617-afd2-1d99b127e7ba' })
  readonly leaveId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'pending' })
  readonly status: TLeavesStatus;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'I need vacation leave' })
  readonly notes: string;
}
