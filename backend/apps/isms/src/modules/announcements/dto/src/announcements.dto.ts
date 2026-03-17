import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAnnouncementDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'No class' })
  readonly classId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'No class' })
  readonly title: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'No class for tuesday' })
  readonly message: number;
}

export class UpdateAnnouncementDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'No class' })
  readonly classId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'No class' })
  readonly title: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'No class for tuesday' })
  readonly message: number;
}
