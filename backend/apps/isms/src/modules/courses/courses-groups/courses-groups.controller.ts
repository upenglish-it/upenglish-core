import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { CoursesGroupsService } from './courses-groups.service';
import { Controller, Post, Body, Get, Param, UseInterceptors, Delete, Patch, Headers } from '@nestjs/common';
import { CreateCourseGroupDTO, UpdateCourseGroupDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Courses Groups')
@Controller('courses-groups')
export class CoursesGroupsController {
  constructor(private readonly coursesGroupsService: CoursesGroupsService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch groups`,
  })
  public async fetchAccount(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesGroupsService.fetch(tokenPayload);
  }

  @Get(':courseGroupId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch a course group`,
  })
  public async fetchById(@Param('courseGroupId') courseGroupId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesGroupsService.fetchById(courseGroupId, tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create a group`,
  })
  public async create(@Body() body: CreateCourseGroupDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesGroupsService.create(body, tokenPayload);
  }

  @Patch(':courseGroupId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update a course`,
  })
  public async updateById(
    @Param('courseGroupId') courseGroupId: string,
    @Body() body: UpdateCourseGroupDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload,
  ): Promise<IResponseHandlerParams> {
    return await this.coursesGroupsService.updateById(courseGroupId, body, tokenPayload);
  }

  @Delete(':groupId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Delete a group`,
  })
  public async softDelete(@Param('groupId') courseId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesGroupsService.softDelete(courseId, tokenPayload);
  }
}
