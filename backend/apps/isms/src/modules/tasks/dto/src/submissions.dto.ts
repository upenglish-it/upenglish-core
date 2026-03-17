import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { TaskAssignee, TaskGeneralInfo, JOI_MESSAGES, TaskCategory, TasksSubmissions } from 'apps/common';

export class CreateSubmissionDTO {
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

  @JoiSchema(Joi.string().required().label('Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: '' })
  readonly createdBy: string;

  @JoiSchema(Joi.string().required().label('Class').messages(JOI_MESSAGES))
  @ApiProperty({ example: '' })
  readonly class: string;

  @JoiSchema(Joi.string().required().label('type').messages(JOI_MESSAGES))
  @ApiProperty({ example: '' })
  readonly type: 'training' | 'official';

  @JoiSchema(Joi.array().required().label('Categories').messages(JOI_MESSAGES))
  @ApiProperty({ example: [] })
  readonly categories: Array<TaskCategory>;
}

export class UpdateSubmissionCategoriesDTO {
  @JoiSchema(Joi.object().required().label('Task Submission').messages(JOI_MESSAGES))
  @ApiProperty({ example: {} })
  readonly taskSubmission: TasksSubmissions;
}

export class ReviewParticipantAnswerDTO {
  @JoiSchema(
    Joi.object({
      categoryIndex: Joi.number().optional().label('Category Index').messages(JOI_MESSAGES),
      questionIndex: Joi.number().optional().label('Question Index').messages(JOI_MESSAGES),
      conclusion: Joi.string().optional().label('Conclusion').messages(JOI_MESSAGES),
      reviewerScore: Joi.string().optional().label('Reviewer score').messages(JOI_MESSAGES),
    })
      .optional()
      .label('Review')
      .messages(JOI_MESSAGES),
  )
  @ApiProperty({ example: 0 })
  readonly review: ReviewParticipantAnswerReview;
}

export interface ReviewParticipantAnswerReview {
  categoryIndex: number;
  questionIndex: number;
  conclusion: string;
  reviewerScore: string;
}
