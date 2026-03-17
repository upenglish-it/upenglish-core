import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { JOI_MESSAGES } from 'apps/common';

export class AddConversationDTO {
  @JoiSchema(Joi.string().required().label('Message').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'Interested in English' })
  public readonly message: string;

  @JoiSchema(Joi.string().required().label('Lead Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'HC51301a4b202d40c6ae95cbb5a76250a2' })
  public readonly leadId: string;
}
