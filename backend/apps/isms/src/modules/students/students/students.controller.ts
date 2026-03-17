import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { StudentsServiceService } from './students.service';
import { Controller, Post, Body, Req, UseInterceptors, Headers, Get, Query, Param, Patch, Put } from '@nestjs/common';
import {
  AddSourcesStudentsDTO,
  AddTagsStudentsDTO,
  CreateBulkStudentsDTO,
  CreateStudentDTO,
  FetchStudentsDTO,
  ManageStudentsDTO,
  UpdateStudentDTO,
} from './dto';
import { JoiPipe } from 'nestjs-joi';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Students')
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsServiceService: StudentsServiceService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch all students`,
  })
  public async fetch(@Query() query: FetchStudentsDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.studentsServiceService.fetch(query, tokenPayload);
  }

  @Get(':id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch student by id`,
  })
  public async fetchById(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.studentsServiceService.fetchById(id, tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create a student`,
  })
  public async create(@Body() body: CreateStudentDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.studentsServiceService.create(body, tokenPayload);
  }

  @Post('bulk')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create a bulk student`,
  })
  public async bulkCreate(
    @Body() body: CreateBulkStudentsDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.studentsServiceService.bulkCreate(body, tokenPayload);
  }

  @Patch(':id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update student`,
  })
  public async update(
    @Param('id') id: string,
    @Body() body: UpdateStudentDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.studentsServiceService.update(id, body, tokenPayload);
  }

  @Put('add-tags')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Add tags to the students`,
  })
  public async addTags(@Body() body: AddTagsStudentsDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.studentsServiceService.addTags(body, tokenPayload);
  }

  @Put('add-sources')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Add sources to the students`,
  })
  public async addSources(
    @Body() body: AddSourcesStudentsDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.studentsServiceService.addSources(body, tokenPayload);
  }

  @Post('manage')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Manage leads` })
  public async manageCandidate(
    @Body(JoiPipe) body: ManageStudentsDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.studentsServiceService.manage(body, tokenPayload);
  }
}
