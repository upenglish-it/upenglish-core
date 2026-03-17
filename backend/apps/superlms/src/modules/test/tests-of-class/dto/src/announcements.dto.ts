import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { JOI_MESSAGES } from 'apps/common';

export class AddAnnouncementDTO {
  @JoiSchema(Joi.string().required().label('Class Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8' })
  public readonly classId: string;

  @JoiSchema(Joi.string().required().label('Class Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8' })
  public readonly testOfClassId: string;

  @JoiSchema(Joi.string().required().label('Student Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8' })
  public readonly studentId: string;

  @JoiSchema(Joi.string().required().label('Title').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'This is a title' })
  public readonly title: string;

  @JoiSchema(Joi.string().required().label('Message').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'This is a message' })
  public readonly message: string;
}

export class GetAnnouncementByIdDTO {
  @JoiSchema(Joi.string().required().label('Class Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '60d5ec49f1b2c8d5f4e4b8c8' })
  public readonly testOfClassId: string;
}
