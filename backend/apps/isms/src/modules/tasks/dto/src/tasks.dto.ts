import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { TaskAssignee, TaskGeneralInfo, JOI_MESSAGES, TaskCategory, TaskStatus, TaskMode, Tasks } from 'apps/common';

export class CreateTaskDTO {
  @JoiSchema(
    Joi.object({
      type: Joi.string().valid('challenge', 'homework').required().label('Type').messages(JOI_MESSAGES),
      title: Joi.string().required().label('Title').messages(JOI_MESSAGES),
      passing: Joi.number().required().label('Passing').messages(JOI_MESSAGES),
      duration: Joi.object({
        noExpiration: Joi.boolean().required().label('No Expiration').messages(JOI_MESSAGES),
        type: Joi.string().valid('minute', 'hour', 'month', 'year').required().label('Type').messages(JOI_MESSAGES),
        value: Joi.number().required().label('Value').messages(JOI_MESSAGES),
      }).required(),
    }).required(),
  )
  @ApiProperty({ example: {} })
  readonly generalInfo: TaskGeneralInfo;

  // @JoiSchema(
  //   Joi.object({
  //     reviewers: Joi.array().required().label('Reviewers').messages(JOI_MESSAGES),
  //     participants: Joi.array()
  //       .items(
  //         Joi.object({
  //           type: Joi.string().valid('class', 'student').required().label('Type').messages(JOI_MESSAGES),
  //           id: Joi.string().required().label('Id').messages(JOI_MESSAGES),
  //         }),
  //       )
  //       .required()
  //       .label('Participants')
  //       .messages(JOI_MESSAGES),
  //   }).required(),
  // )
  // @ApiProperty({ example: 'English Pro' })
  // readonly assignee: Assignee;

  @JoiSchema(Joi.string().required().label('Status').messages(JOI_MESSAGES))
  @ApiProperty({ example: '' })
  readonly mode: TaskMode;

  @JoiSchema(Joi.string().required().label('Status').messages(JOI_MESSAGES))
  @ApiProperty({ example: '' })
  readonly course: string;

  @JoiSchema(Joi.string().required().label('Class').messages(JOI_MESSAGES))
  @ApiProperty({ example: '' })
  readonly class: string;
}

export class UpdateTaskBuilderDTO {
  @JoiSchema(Joi.array().required().label('Categories').messages(JOI_MESSAGES))
  @ApiProperty({ example: [] })
  readonly categories: Array<TaskCategory>;
}

export class UpdateTaskSettingsDTO {
  @JoiSchema(
    Joi.object({
      type: Joi.string().valid('challenge', 'homework').required().label('Type').messages(JOI_MESSAGES),
      title: Joi.string().required().label('Title').messages(JOI_MESSAGES),
      passing: Joi.number().required().label('Passing').messages(JOI_MESSAGES),
      instances: Joi.number().required().label('Instances').messages(JOI_MESSAGES),
      duration: Joi.object({
        noExpiration: Joi.boolean().required().label('No Expiration').messages(JOI_MESSAGES),
        type: Joi.string().valid('minute', 'hour', 'month', 'year').required().label('Type').messages(JOI_MESSAGES),
        value: Joi.number().required().label('Value').messages(JOI_MESSAGES),
      }).required(),
    }).required(),
  )
  @ApiProperty({ example: {} })
  readonly generalInfo: TaskGeneralInfo;

  @JoiSchema(
    Joi.object({
      reviewers: Joi.array().required().label('Reviewers').messages(JOI_MESSAGES),
      participants: Joi.array()
        .items(
          Joi.object({
            type: Joi.string().valid('class', 'student').required().label('Type').messages(JOI_MESSAGES),
            id: Joi.string().required().label('Id').messages(JOI_MESSAGES),
          }),
        )
        .required()
        .label('Participants')
        .messages(JOI_MESSAGES),
    }).required(),
  )
  @ApiProperty({ example: {} })
  readonly assignee: TaskAssignee;

  @JoiSchema(Joi.string().required().label('Status').messages(JOI_MESSAGES))
  @ApiProperty({ example: '' })
  readonly status: TaskStatus;

  @JoiSchema(Joi.string().required().label('Status').messages(JOI_MESSAGES))
  @ApiProperty({ example: '' })
  readonly mode: TaskMode;

  @JoiSchema(Joi.string().required().label('Status').messages(JOI_MESSAGES))
  @ApiProperty({ example: '' })
  readonly course: string;

  @JoiSchema(Joi.string().required().label('Class').messages(JOI_MESSAGES))
  @ApiProperty({ example: '' })
  readonly class: string;
}

export class ImportTaskCSVDTO {
  @JoiSchema(Joi.array().required().label('Records').messages(JOI_MESSAGES))
  @ApiProperty({ example: [] })
  readonly records: Tasks[];
}

export class ManageInstancesSettingsDTO {
  @JoiSchema(Joi.array().required().label('id').messages(JOI_MESSAGES))
  @ApiProperty({ example: ['1234567890'] })
  readonly ids: string[];

  @JoiSchema(Joi.string().required().label('Type').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'student', enum: ['student', 'class'] })
  readonly type: 'student' | 'class';
}
