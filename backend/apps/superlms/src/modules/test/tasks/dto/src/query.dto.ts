// NestJs imports
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { JOI_MESSAGES } from 'apps/common';
import { ApiProperty } from '@nestjs/swagger';

const StateSettingsModeC = ['viewing', 'editing'] as const;
const StateSettingsActionC = ['teacher-reviewing', 'student-answering', 'builder-editing', 'student-viewing-results'] as const;

export class QueryGetByIdDTO {
  @JoiSchema(
    Joi.string()
      .required()
      .allow('')
      .valid(...StateSettingsModeC)
      .label('Mode')
      .messages(JOI_MESSAGES)
  )
  @ApiProperty({ example: 'template' })
  public readonly mode: StateSettingsModeT;

  @JoiSchema(
    Joi.string()
      .required()
      .allow('')
      .valid(...StateSettingsActionC)
      .label('Type')
      .messages(JOI_MESSAGES)
  )
  @ApiProperty({ example: 'template' })
  public readonly action: StateSettingsActionT;

  @JoiSchema(Joi.string().required().allow('').valid('template', 'test').label('Type').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'template' })
  public readonly type: string;
}

export class QueryUpdateByIdDTO {
  @JoiSchema(
    Joi.string()
      .required()
      .allow('')
      .valid(...StateSettingsModeC)
      .label('Mode')
      .messages(JOI_MESSAGES)
  )
  @ApiProperty({ example: 'template' })
  public readonly mode: StateSettingsModeT;

  @JoiSchema(
    Joi.string()
      .required()
      .allow('')
      .valid(...StateSettingsActionC)
      .label('Type')
      .messages(JOI_MESSAGES)
  )
  @ApiProperty({ example: 'template' })
  public readonly action: StateSettingsActionT;

  @JoiSchema(Joi.string().required().allow('').valid('template', 'test').label('Type').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'template' })
  public readonly type: string;
}

type StateSettingsModeT = (typeof StateSettingsModeC)[number];
type StateSettingsActionT = (typeof StateSettingsActionC)[number];
