import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams, MongoDBWebhook } from 'apps/common';
import { TasksService } from './tasks.service';
import { Controller, Post, Body, Get, Param, UseInterceptors, Delete, Patch, Headers, Query } from '@nestjs/common';
import {
  CreateSubmissionDTO,
  CreateTaskDTO,
  ImportTaskCSVDTO,
  ManageInstancesSettingsDTO,
  ReviewParticipantAnswerDTO,
  UpdateSubmissionCategoriesDTO,
  UpdateTaskBuilderDTO,
  UpdateTaskSettingsDTO,
} from './dto';
import { TasksSubmissionsService } from './tasks-submissions.service';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Tasks')
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly tasksSubmissionsService: TasksSubmissionsService
  ) {}

  // @Post('webhook')
  // @ApiOperation({ summary: `Receive income webhook` })
  // public async webhook(@Body() body: MongoDBWebhook): Promise<IResponseHandlerParams> {
  //   return await this.tasksService.webhook(body);
  // }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Create task` })
  public async create(@Body() body: CreateTaskDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.tasksService.create(body, tokenPayload);
  }

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch tasks` })
  public async fetch(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.tasksService.fetch(tokenPayload);
  }

  @Get(':taskId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch tag by id` })
  public async fetchById(
    @Param('taskId') taskId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksService.fetchById(taskId, tokenPayload);
  }

  @Patch(':taskId/builder')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update builder` })
  public async updateBuilderById(
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskBuilderDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksService.updateBuilderById(taskId, body, tokenPayload);
  }

  @Patch(':taskId/settings')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update settings` })
  public async updateSettingsById(
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskSettingsDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksService.updateSettingsById(taskId, body, tokenPayload);
  }

  @Get(':taskId/participants/submissions')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch participants submissions` })
  public async participantsSubmissions(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.tasksService.participantsSubmissions(tokenPayload);
  }

  @Get(':taskId/assignee/participants')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch assignee participants` })
  public async assigneeParticipants(
    @Param('taskId') taskId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksService.assigneeParticipants(taskId, tokenPayload);
  }

  @Delete(':taskId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Delete a task` })
  public async softDelete(
    @Param('taskId') taskId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksService.softDelete(taskId, tokenPayload);
  }

  @Delete(':taskId/assignee/participants/manage-instances')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Manage the participant instance` })
  public async manageParticipantInstances(
    @Param('taskId') taskId: string,
    @Body() body: ManageInstancesSettingsDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksService.manageParticipantInstances(taskId, body, tokenPayload);
  }

  @Get(':taskId/assignee/participants/manage-instances')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Get the participant instance` })
  public async getParticipantInstances(
    @Param('taskId') taskId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksService.getParticipantInstances(taskId, tokenPayload);
  }

  @Get('participant/tasks')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch by shared participant` })
  public async sharedParticipant(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.tasksService.sharedParticipant(tokenPayload);
  }

  @Get('submissions/participants/:taskId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch submissions of participants` })
  public async submissionsOfParticipants(
    @Param('taskId') taskId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksSubmissionsService.submissionsOfParticipants(taskId, tokenPayload);
  }

  @Get('submissions/task/:submissionId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch submitted task` })
  public async submissionsFetchById(
    @Param('submissionId') submissionId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksSubmissionsService.fetchById(submissionId, tokenPayload);
  }

  @Get('submissions/participant/submissions/:taskId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch participant submission by task id` })
  public async participantSubmissionsByTask(
    @Param('taskId') taskId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksSubmissionsService.participantSubmissionsByTask(taskId, tokenPayload);
  }

  @Delete('submissions/participant/submissions/:taskId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch participant submission by task id` })
  public async deleteSubmissions(
    @Param('taskId') taskId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksSubmissionsService.deleteSubmissions(taskId, tokenPayload);
  }

  @Get('submissions/participant/submissions')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch participant submission` })
  public async participantSubmissions(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.tasksSubmissionsService.participantSubmissions(tokenPayload);
  }

  @Post('submissions/participant')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Submit participant submission` })
  public async submissionsCreate(
    @Body() body: CreateSubmissionDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksSubmissionsService.create(body, tokenPayload);
  }

  @Post('submissions/participant/review-answer/:submissionId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Review participant answer` })
  public async submissionsReviewParticipantAnswer(
    @Param('submissionId') submissionId: string,
    @Body() body: ReviewParticipantAnswerDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksSubmissionsService.reviewParticipantAnswer(submissionId, body, tokenPayload);
  }

  @Patch('submissions/participant/categories/:submissionId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update submission categories` })
  public async submissionsUpdateCategoriesById(
    @Param('submissionId') submissionId: string,
    @Body() body: UpdateSubmissionCategoriesDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksSubmissionsService.updateCategoriesById(submissionId, body, tokenPayload);
  }

  @Get('submissions/reports')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch reports` })
  public async reports(@Query() query: any, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.tasksService.reports(query, tokenPayload);
  }

  @Post('import-csv')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Import CSV` })
  public async importCSV(@Body() body: ImportTaskCSVDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.tasksService.importCSV(body, tokenPayload);
  }

  @Post('copy-to-branch/:branchId/:taskId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Copy to branch` })
  public async copyToBranch(
    @Param('branchId') branchId: string,
    @Param('taskId') taskId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksService.copyToBranch(branchId, taskId, tokenPayload);
  }
}
