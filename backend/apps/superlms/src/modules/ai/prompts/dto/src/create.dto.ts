import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { JOI_MESSAGES } from 'apps/common';

export class CreatePromptDTO {
  @JoiSchema(Joi.string().required().label('Name').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'IELTS Speaking Prompt' })
  public readonly name: string;

  @JoiSchema(Joi.string().required().label('Provider').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'openai', enum: ['openai', 'gemini', 'openrouter'] })
  public readonly provider: string;

  @JoiSchema(Joi.string().required().label('Model').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'gpt-4o-2024-08-06' })
  public readonly model: string;

  @JoiSchema(Joi.string().required().label('API Key').messages(JOI_MESSAGES))
  @ApiProperty({ example: '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' })
  public readonly apiKey: string;

  @JoiSchema(Joi.string().required().label('Message').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'You are a helpful assistant.' })
  public readonly message: string;
}
