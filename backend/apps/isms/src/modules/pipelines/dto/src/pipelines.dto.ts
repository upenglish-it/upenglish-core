import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { JOI_MESSAGES, PipelineStage } from 'apps/common';

export class PipelineLeadInfoDTO {
  @JoiSchema(Joi.string().required().label('Lead Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'HC51301a4b202d40c6ae95cbb5a76250a2' })
  public readonly leadId: string;
}

export class CreatePipelineDTO {
  @JoiSchema(Joi.string().required().label('Title').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'Fullstack Developer' })
  public readonly title: string;

  @JoiSchema(Joi.string().optional().allow('').valid('leads', 'task').label('Type').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'leads' })
  public readonly type: string;
}

export class ClonePipelineDTO {
  @JoiSchema(Joi.string().required().label('Title').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'Fullstack Developer' })
  public readonly title: string;

  @JoiSchema(Joi.string().required().label('Pipeline Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'HC51301a4b202d40c6ae95cbb5a76250a2' })
  public readonly pipelineId: string;
}

export class UpdatePipelineDTO {
  // @JoiSchema(Joi.string().required().label('Title').messages(JOI_MESSAGES))
  // @ApiProperty({ example: 'Fullstack Developer' })
  // public readonly title: string;

  // @JoiSchema(Joi.string().required().label('Description').messages(JOI_MESSAGES))
  // @ApiProperty({ example: 'Full Pipeline Description Duties and Responsibilities ' })
  // public readonly description: string;

  // @JoiSchema(Joi.string().required().label('Type').messages(JOI_MESSAGES))
  // @ApiProperty({ example: 'full-time' })
  // public readonly type: string;

  // @JoiSchema(Joi.string().required().label('Closing Date').messages(JOI_MESSAGES))
  // @ApiProperty({ example: '01/01/2023' })
  // public readonly closingDate: string;

  // @JoiSchema(Joi.number().required().label('Quantity').messages(JOI_MESSAGES))
  // @ApiProperty({ example: 1 })
  // public readonly quantity: number;

  @JoiSchema(Joi.object().required().label('Details').messages(JOI_MESSAGES))
  @ApiProperty({
    example: {
      title: 'Java Developer',
    },
  })
  public readonly details: {
    title: string;
  };
}

export class UpdatePipelineStatusDTO {
  @JoiSchema(Joi.string().required().valid('active', 'inactive').label('Status').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'active' })
  public readonly status: 'active' | 'inactive';
}

// export class UpdatePipelineDTO {
//   @JoiSchema(Joi.string().required().label('Title').messages(JOI_MESSAGES))
//   @ApiProperty({ example: 'Fullstack Developer' })
//   public readonly title: string;

//   @JoiSchema(Joi.string().required().label('Description').messages(JOI_MESSAGES))
//   @ApiProperty({ example: 'Full Pipeline Description Duties and Responsibilities ' })
//   public readonly description: string;

//   @JoiSchema(Joi.string().required().label('Type').messages(JOI_MESSAGES))
//   @ApiProperty({ example: 'full-time' })
//   public readonly type: string;

//   @JoiSchema(Joi.string().required().label('Closing Date').messages(JOI_MESSAGES))
//   @ApiProperty({ example: '01/01/2023' })
//   public readonly closingDate: string;

//   @JoiSchema(Joi.number().required().label('Quantity').messages(JOI_MESSAGES))
//   @ApiProperty({ example: 1 })
//   public readonly quantity: number;
// }

export class AssignPipelinePipelineDTO {
  @JoiSchema(Joi.string().required().label('Pipeline Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'HC51301a4b202d40c6ae95cbb5a76250a2' })
  public readonly pipelineId: string;
}

export class AddPipelineStagePipelineDTO {
  @JoiSchema(Joi.object().required().label('Stage').messages(JOI_MESSAGES))
  @ApiProperty({
    example: {
      order: 0,
      state: 'start',
      type: 'sourced',
      title: 'Untitled1',
      color: '#FFFFFF',
      id: 'HCC059BE9C977C4375855A438262A61873',
    },
  })
  public readonly stage: PipelineStage;

  @JoiSchema(Joi.array().required().label('Stages').messages(JOI_MESSAGES))
  @ApiProperty({
    example: {
      new: true,
      id: 'HCC059BE9C977C4375855A438262A61873',
    },
  })
  public readonly stages: Array<{ id: string; new: boolean }>;

  @JoiSchema(Joi.string().required().valid('leads', 'task').label('Type').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'leads' })
  public readonly type: 'leads' | 'task';
}

export class SortPipelineStagePipelineDTO {
  @JoiSchema(Joi.object().required().label('Current Stage').messages(JOI_MESSAGES))
  @ApiProperty({
    example: {
      order: 0,
      state: 'start',
      type: 'sourced',
      title: 'Untitled1',
      color: '#FFFFFF',
      id: 'HCC059BE9C977C4375855A438262A61873',
    },
  })
  public readonly currentStage: PipelineStage;

  @JoiSchema(Joi.object().required().label('Compare Stage').messages(JOI_MESSAGES))
  @ApiProperty({
    example: {
      order: 0,
      state: 'start',
      type: 'sourced',
      title: 'Untitled1',
      color: '#FFFFFF',
      id: 'HCC059BE9C977C4375855A438262A61873',
    },
  })
  public readonly compareStage: PipelineStage;
}

export class UpdatePipelineStagePipelineDTO {
  @JoiSchema(Joi.object().required().label('Stage').messages(JOI_MESSAGES))
  @ApiProperty({
    example: {
      title: 'Untitled1',
      color: '#FFFFFF',
    },
  })
  public readonly stage: PipelineStage;
}

export class RemovePipelineStagePipelineDTO {
  @JoiSchema(Joi.string().required().label('Remove Pipeline stage Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'HC51301a4b202d40c6ae95cbb5a76250a2' })
  public readonly removePipelineStageId: string;

  @JoiSchema(Joi.string().required().label('Move Pipeline stage Id').messages(JOI_MESSAGES))
  @ApiProperty({
    example: 'HC51301a4b202d40c6ae95cbb5a76250a2',
    description: 'if @removePipelineStageId has a leads then push all leads in @receiverPipelineStageId',
  })
  public readonly receiverPipelineStageId: string;

  @JoiSchema(Joi.string().required().valid('leads', 'task').label('Type').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'leads' })
  public readonly type: 'leads' | 'task';
}

export class AssignCandidatesPipelineDTO {
  @JoiSchema(Joi.string().required().label('Pipeline stage Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'HC51301a4b202d40c6ae95cbb5a76250a2' })
  public readonly pipelineStageId: string;

  @JoiSchema(Joi.array().items(Joi.string()).required().label('Candidate Ids').messages(JOI_MESSAGES))
  @ApiProperty({ example: ['HC51301a4b202d40c6ae95cbb5a76250a2'] })
  public readonly leadIds: Array<string>;

  @JoiSchema(Joi.string().required().valid('leads', 'task').label('Type').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'leads' })
  public readonly type: 'leads' | 'task';
}

export class UnAssignCandidatesPipelineDTO {
  @JoiSchema(Joi.string().required().label('Pipeline stage Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'HC51301a4b202d40c6ae95cbb5a76250a2' })
  public readonly pipelineStageId: string;

  @JoiSchema(Joi.array().items(Joi.string()).required().label('Candidate Ids').messages(JOI_MESSAGES))
  @ApiProperty({ example: ['HC51301a4b202d40c6ae95cbb5a76250a2'] })
  public readonly leadIds: Array<string>;

  @JoiSchema(Joi.string().required().valid('leads', 'task').label('Type').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'leads' })
  public readonly type: 'leads' | 'task';
}

export class GetPipelineQueryDTO {
  @JoiSchema(Joi.string().required().valid('leads', 'task').label('Type').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'leads' })
  public readonly type: 'leads' | 'task';
}
export class DeletePipelineQueryDTO {
  @JoiSchema(Joi.string().required().valid('leads', 'task').label('Type').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'leads' })
  public readonly type: 'leads' | 'task';
}

export class ManageTaskInTaskPipelineDTO {
  @JoiSchema(Joi.object().required().label('Stage Id').messages(JOI_MESSAGES))
  @ApiProperty({
    example: {
      id: 'HC51301a4b202d40c6ae95cbb5a76250a2',
      currentStageId: 'HC51301a4b202d40c6ae95cbb5a76250a2',
      moveToStageId: 'HC51301a4b202d40c6ae95cbb5a76250a2',
    },
  })
  public readonly stagesIds: {
    taskId?: string;
    currentStageId: string;
    moveToStageId?: string;
  };

  @JoiSchema(Joi.string().required().valid('move', 'add', 'edit').label('Action').messages(JOI_MESSAGES))
  @ApiProperty({
    example: 'move',
  })
  public readonly action: 'move' | 'add' | 'edit';

  @JoiSchema(Joi.string().required().label('Name').messages(JOI_MESSAGES))
  @ApiProperty({
    example: 'Todo',
  })
  public readonly name: string;

  @JoiSchema(Joi.string().optional().allow('').label('Notes').messages(JOI_MESSAGES))
  @ApiProperty({
    example: 'This is a task notes',
  })
  public readonly notes?: string;
}

export class DeleteTaskInTaskPipelineDTO {
  @JoiSchema(Joi.string().required().label('Task ID').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'HC51301a4b202d40c6ae95cbb5a76250a2' })
  public readonly taskId: string;
}
