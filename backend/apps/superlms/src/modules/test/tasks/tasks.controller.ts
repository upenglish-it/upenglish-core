// Nestjs imports
import { JoiPipe } from 'nestjs-joi';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, HttpCode, HttpStatus, Headers, Get, UseInterceptors, Body, Post, Param, Patch, Query, Delete } from '@nestjs/common';
// Services
import { TasksService } from './tasks.service';
// Commons
import { HTTPInterceptor } from 'apps/common';
import { IAuthTokenPayload, IResponseHandlerParams, ResponseHandlerService, STATUS_CODE } from 'apps/common';
// DTO
import { AddNotesInTimelineDTO, CreateTaskDTO, QueryGetByIdDTO, QueryUpdateByIdDTO, ListsDTO, StudentSubmitTaskDTO, UpdateByIdTaskDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch created tasks` })
  public async getAll(@Query(JoiPipe) query: ListsDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.tasksService.getAll(query, tokenPayload);
  }

  @Get(':taskId')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch created tasks` })
  public async getById(
    @Param('taskId') taskId: string,
    @Query(JoiPipe) query: QueryGetByIdDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksService.getById(taskId, query, tokenPayload);
  }

  @Delete(':taskId')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Delete deleted task` })
  public async deleteById(
    @Param('taskId') taskId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksService.deleteById(taskId, tokenPayload);
  }

  @Post('student/submit-task')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Student submit the task` })
  public async studentSubmitTask(@Body(JoiPipe) body: StudentSubmitTaskDTO): Promise<IResponseHandlerParams> {
    this.tasksService.studentSubmitTask(body);
    return ResponseHandlerService({
      success: true,
      httpCode: HttpStatus.OK,
      statusCode: STATUS_CODE.OK,
      message: 'Successfully submitted',
    });
  }

  @Post('teacher/mark-task-as-reviewed')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Teacher mark the task as reviewed` })
  public async teacherMarkTaskAsReviewed(@Body(JoiPipe) body: StudentSubmitTaskDTO): Promise<IResponseHandlerParams> {
    return await this.tasksService.teacherMarkTaskAsReviewed(body);
  }

  @Post('timeline/notes')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Add notes in timeline` })
  public async addNotesInTimeline(@Body(JoiPipe) body: AddNotesInTimelineDTO): Promise<IResponseHandlerParams> {
    return await this.tasksService.addNotesInTimeline(body);
  }

  @Get('timeline/:classId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Get all notes in timeline` })
  public async getAllTimelineByClassId(@Query(JoiPipe) query: ListsDTO, @Param('classId') classId: string): Promise<IResponseHandlerParams> {
    return await this.tasksService.getAllTimelineByClassId(query, classId);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Create a task` })
  public async create(
    @Body(JoiPipe) body: CreateTaskDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksService.create(body, tokenPayload);
  }

  @Patch(':taskId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update a task by id` })
  public async updateById(
    @Param('taskId') taskId: string,
    @Query(JoiPipe) query: QueryUpdateByIdDTO,
    @Body(JoiPipe) body: UpdateByIdTaskDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.tasksService.updateById(taskId, query, body, tokenPayload);
  }
}
