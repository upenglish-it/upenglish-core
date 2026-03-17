import { Controller, HttpCode, HttpStatus, Headers, Get, UseInterceptors, Body, Post, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { HTTPInterceptor } from 'apps/common';
import {
  AddPipelineStagePipelineDTO,
  ClonePipelineDTO,
  CreatePipelineDTO,
  RemovePipelineStagePipelineDTO,
  UpdatePipelineStatusDTO,
  UpdatePipelineStagePipelineDTO,
  AddNoteDTO,
  PipelineLeadInfoDTO,
  AddConversationDTO,
  GetPipelineQueryDTO,
  ManageTaskInTaskPipelineDTO,
  DeleteTaskInTaskPipelineDTO,
} from './dto';
import { JoiPipe } from 'nestjs-joi';
import { PipelinesService } from './pipelines.service';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Pipelines')
@Controller('pipelines')
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch created pipeline` })
  public async fetch(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    console.log('tokenPayload', tokenPayload);
    return await this.pipelinesService.fetch(tokenPayload);
  }

  @Get(':pipelineId')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch pipeline by id` })
  public async fetchById(
    @Param('pipelineId') pipelineId: string,
    @Query(JoiPipe) query: GetPipelineQueryDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.fetchById(pipelineId, query, tokenPayload);
  }

  @Get('name/:companyName')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch pipeline by company name` })
  public async fetchByCo(
    @Param('companyName') companyName: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.fetchByCompanyName(companyName, tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Create a pipeline` })
  public async create(
    @Body(JoiPipe) body: CreatePipelineDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.create(body, tokenPayload);
  }

  @Post('clone')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Clone a pipeline` })
  public async clone(
    @Body(JoiPipe) body: ClonePipelineDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.clone(body, tokenPayload);
  }

  @Patch(':pipelineId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update a pipeline` })
  public async update(
    @Param('pipelineId') pipelineId: string,
    @Body(JoiPipe) body: any,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.update(pipelineId, body, tokenPayload);
  }

  @Patch(':pipelineId/status')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update a pipeline status` })
  public async updateStatus(
    @Param('pipelineId') pipelineId: string,
    @Body(JoiPipe) body: UpdatePipelineStatusDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.updateStatus(pipelineId, body, tokenPayload);
  }

  @Delete(':pipelineId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Delete a pipeline` })
  public async delete(
    @Param('pipelineId') pipelineId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.delete(pipelineId, tokenPayload);
  }

  // @Get(':pipelineId/leads')
  // @UseInterceptors(HTTPInterceptor)
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: `Fetch assigned leads` })
  // public async fetchAssignedCandidates(@Param('pipelineId') pipelineId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.pipelinesService.fetchAssignedCandidates(pipelineId, tokenPayload);
  // }

  // @Patch(':pipelineId/pipeline')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({ summary: `Assigned pipeline` })
  // public async assignPipeline(@Param('pipelineId') pipelineId: string, @Body(JoiPipe) body: AssignPipelinePipelineDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.pipelinesService.assignPipeline(pipelineId, body, tokenPayload);
  // }

  @Post(':pipelineId/stage')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Add pipeline stage` })
  public async addPipelineStage(
    @Param('pipelineId') pipelineId: string,
    @Body(JoiPipe) body: AddPipelineStagePipelineDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.addPipelineStage(pipelineId, body, tokenPayload);
  }

  @Delete(':pipelineId/stage')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Remove pipeline stage` })
  public async removePipelineStage(
    @Param('pipelineId') pipelineId: string,
    @Body(JoiPipe) body: RemovePipelineStagePipelineDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.removePipelineStage(pipelineId, body, tokenPayload);
  }

  @Patch(':pipelineId/stage/:stageId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update pipeline stage` })
  public async updatePipelineStage(
    @Param('pipelineId') pipelineId: string,
    @Param('stageId') stageId: string,
    @Body(JoiPipe) body: UpdatePipelineStagePipelineDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.updatePipelineStage(pipelineId, stageId, body, tokenPayload);
  }

  @Get(':pipelineId/lead-info')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch pipeline lead info` })
  public async leadInfo(
    @Param('pipelineId') pipelineId: string,
    @Query(JoiPipe) query: PipelineLeadInfoDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.leadInfo(pipelineId, query, tokenPayload);
  }

  @Post(':pipelineId/notes')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Add notes` })
  public async addNote(
    @Param('pipelineId') pipelineId: string,
    @Body(JoiPipe) body: AddNoteDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.addNote(pipelineId, body, tokenPayload);
  }

  @Get(':pipelineId/notes/:leadId')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch notes` })
  public async fetchNotes(
    @Param('pipelineId') pipelineId: string,
    @Param('leadId') leadId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.fetchNotes(pipelineId, leadId, tokenPayload);
  }

  @Post(':pipelineId/conversations')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Add conversations` })
  public async addConversations(
    @Param('pipelineId') pipelineId: string,
    @Body(JoiPipe) body: AddConversationDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.addConversations(pipelineId, body, tokenPayload);
  }

  @Get(':pipelineId/conversations/:leadId')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch conversations` })
  public async fetchConversations(
    @Param('pipelineId') pipelineId: string,
    @Param('leadId') leadId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.fetchConversations(pipelineId, leadId, tokenPayload);
  }

  @Get(':pipelineId/activity-logs/:leadId')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch conversations` })
  public async fetchActivityLogs(
    @Param('pipelineId') pipelineId: string,
    @Param('leadId') leadId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.fetchActivityLogs(pipelineId, leadId, tokenPayload);
  }

  // Add or move task in task pipeline
  @Patch(':pipelineId/task')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Add or move task in task pipeline` })
  public async manageTaskInTaskPipeline(
    @Param('pipelineId') pipelineId: string,
    @Body(JoiPipe) body: ManageTaskInTaskPipelineDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.manageTaskInTaskPipeline(pipelineId, body, tokenPayload);
  }

  // Delete task in task pipeline
  @Delete(':pipelineId/task')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Delete a task in task pipeline` })
  public async deleteTaskInTaskPipeline(
    @Param('pipelineId') pipelineId: string,
    @Query(JoiPipe) query: DeleteTaskInTaskPipelineDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.pipelinesService.deleteTaskInTaskPipeline(pipelineId, query, tokenPayload);
  }
}
